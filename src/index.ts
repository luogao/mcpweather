/**
 * Weather MCP Server
 * 提供基于美国国家气象局(NWS)的天气数据服务
 * 允许查询天气预报和天气警报信息
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod"; // 用于请求参数验证的库

// API常量定义
const NWS_API_BASE = "https://api.weather.gov"; // 美国国家气象局API基础URL
const USER_AGENT = "weather-app/1.0"; // 用户代理标识

/**
 * 封装网络请求函数，处理与NWS API的通信
 * @param url 请求URL
 * @returns 请求结果数据或null(出错时)
 */
async function makeNWSRequest<T> (url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT, // 标识API请求来源
    Accept: "application/geo+json", // 请求GeoJSON格式数据
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${ response.status }`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

// 接口定义 - 天气警报数据结构
interface AlertFeature {
  properties: {
    event?: string;      // 事件类型(如: Flood Warning)
    areaDesc?: string;   // 影响区域描述
    severity?: string;   // 严重程度
    status?: string;     // 状态(Actual, Test等)
    headline?: string;   // 警报标题
  };
}

/**
 * 格式化天气警报信息
 * @param feature 警报数据对象
 * @returns 格式化后的警报文本
 */
function formatAlert (feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${ props.event || "Unknown" }`,
    `Area: ${ props.areaDesc || "Unknown" }`,
    `Severity: ${ props.severity || "Unknown" }`,
    `Status: ${ props.status || "Unknown" }`,
    `Headline: ${ props.headline || "No headline" }`,
    "---",
  ].join("\n");
}

// 接口定义 - 天气预报数据结构
interface ForecastPeriod {
  name?: string;           // 预报时段名称(如Today, Tonight等)
  temperature?: number;    // 温度值
  temperatureUnit?: string; // 温度单位(F或C)
  windSpeed?: string;      // 风速
  windDirection?: string;  // 风向
  shortForecast?: string;  // 预报简述
}

// API响应接口定义
interface AlertsResponse {
  features: AlertFeature[]; // 警报数据数组
}

interface PointsResponse {
  properties: {
    forecast?: string;    // 预报数据URL
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[]; // 预报数据数组
  };
}

// 创建MCP服务器实例
const server = new McpServer({
  name: "weather",          // 服务名称
  version: "1.0.0",         // 服务版本
  capabilities: {
    resources: {},          // 定义资源能力(这里未使用)
    tools: {},              // 定义工具能力(这里未使用,使用server.tool注册)
  },
});

/**
 * 注册天气警报工具
 * 允许基于美国州代码获取天气警报信息
 */
server.tool(
  "get-alerts",            // 工具ID
  "Get weather alerts for a state", // 工具描述
  {
    // 参数定义和验证规则
    state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
  },
  async ({ state }) => {
    // 执行函数
    const stateCode = state.toUpperCase(); // 确保状态代码大写
    const alertsUrl = `${ NWS_API_BASE }/alerts?area=${ stateCode }`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    // 处理请求失败情况
    if (!alertsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve alerts data",
          },
        ],
      };
    }

    // 处理无警报情况
    const features = alertsData.features || [];
    if (features.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No active alerts for ${ stateCode }`,
          },
        ],
      };
    }

    // 格式化并返回警报信息
    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${ stateCode }:\n\n${ formattedAlerts.join("\n") }`;

    return {
      content: [
        {
          type: "text",
          text: alertsText,
        },
      ],
    };
  },
);

/**
 * 注册天气预报工具
 * 允许基于经纬度坐标获取天气预报信息
 * 注意: 此API仅支持美国境内的位置
 */
server.tool(
  "get-forecast",         // 工具ID
  "Get weather forecast for a location", // 工具描述
  {
    // 参数定义和验证规则
    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
  },
  async ({ latitude, longitude }) => {
    // 步骤1: 获取网格点数据
    const pointsUrl = `${ NWS_API_BASE }/points/${ latitude.toFixed(4) },${ longitude.toFixed(4) }`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    // 处理请求失败或不支持的区域
    if (!pointsData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve grid point data for coordinates: ${ latitude }, ${ longitude }. This location may not be supported by the NWS API (only US locations are supported).`,
          },
        ],
      };
    }

    // 获取预报URL
    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to get forecast URL from grid point data",
          },
        ],
      };
    }

    // 步骤2: 获取天气预报数据
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
    if (!forecastData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve forecast data",
          },
        ],
      };
    }

    // 处理无预报数据的情况
    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No forecast periods available",
          },
        ],
      };
    }

    // 格式化预报数据
    const formattedForecast = periods.map((period: ForecastPeriod) =>
      [
        `${ period.name || "Unknown" }:`,
        `Temperature: ${ period.temperature || "Unknown" }°${ period.temperatureUnit || "F" }`,
        `Wind: ${ period.windSpeed || "Unknown" } ${ period.windDirection || "" }`,
        `${ period.shortForecast || "No forecast available" }`,
        "---",
      ].join("\n"),
    );

    // 返回格式化的预报信息
    const forecastText = `Forecast for ${ latitude }, ${ longitude }:\n\n${ formattedForecast.join("\n") }`;

    return {
      content: [
        {
          type: "text",
          text: forecastText,
        },
      ],
    };
  },
);

/**
 * 主函数 - 启动服务器
 * 使用标准输入/输出作为通信通道
 */
async function main () {
  const transport = new StdioServerTransport(); // 创建标准IO传输层
  await server.connect(transport); // 连接服务器到传输层
  console.error("Weather MCP Server running on stdio"); // 记录启动信息
}

// 程序入口点
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1); // 发生错误时退出
});