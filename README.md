# Weather MCP Server

一个基于Model Context Protocol (MCP)的天气信息服务，提供美国各地区的天气预报和警报信息。

## 项目介绍

Weather MCP Server是一个轻量级服务，通过美国国家气象局(NWS)的公共API提供天气数据。该服务实现了MCP协议，可以与支持MCP的AI助手和应用程序集成，使它们能够获取并理解天气信息。

### 主要功能

* **天气预报** - 基于经纬度坐标获取详细的天气预报信息
* **天气警报** - 基于美国州代码获取当前活跃的天气警报

### 限制

* 仅支持美国境内的位置（基于NWS API的限制）
* 经纬度必须在有效范围内（纬度：-90至90，经度：-180至180）

## MCP服务介绍

### 什么是MCP？

Model Context Protocol (MCP)是一个开放协议，用于标准化应用程序如何向大语言模型(LLM)提供上下文。MCP就像AI应用程序的"USB-C接口"，提供了一种标准化方式来连接AI模型与不同的数据源和工具。

### MCP的基本架构

MCP遵循客户端-服务器架构：

* **MCP主机**：像Claude Desktop、IDE或AI工具等需要通过MCP访问数据的程序
* **MCP客户端**：与服务器保持1:1连接的协议客户端
* **MCP服务器**：通过标准化的Model Context Protocol暴露特定功能的轻量级程序
* **数据源**：可以是本地数据（文件、数据库）或远程服务（API）

### MCP服务器的特点

* **模块化**：每个服务器提供特定的功能和数据
* **标准化**：通过统一协议与各种客户端通信
* **安全**：数据保留在您的基础设施内
* **灵活**：支持不同的传输方式（stdio, SSE等）

### 本项目中的MCP实现

在这个Weather MCP Server项目中：

1. **McpServer**：核心服务器组件，管理业务逻辑和协议处理
   - 注册工具（get-alerts和get-forecast）
   - 处理请求和响应格式化

2. **StdioServerTransport**：通信层组件，通过标准输入/输出流处理消息
   - 从stdin读取客户端请求
   - 将结果写入stdout
   - 日志写入stderr

这种设计允许服务被AI助手或其他支持MCP的应用程序作为工具调用，无需启动独立的网络服务器。

## 构建指南

### 前提条件

* Node.js (v16 或更高)
* npm (v7 或更高)

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

这将使用TypeScript编译器构建项目，并使输出文件可执行。

### 本地测试

你可以使用以下方式测试服务：

1. **直接运行**

```bash
node ./build/index.js
```

2. **作为CLI工具安装**

```bash
# 全局安装
npm install -g .

# 或创建本地链接
npm link
```

安装后，可以直接使用命令调用：

```bash
weather
```

3. **使用MCP Inspector测试**

MCP Inspector是一个用于测试和检查MCP服务器的交互式调试工具：

```bash
# 安装MCP Inspector
npm install -g @modelcontextprotocol/inspector

# 启动Inspector并连接到你的服务
mcp-inspector --command "node ./build/index.js"
```

### 与AI助手集成

如果你使用支持MCP的AI助手（如Claude Desktop）：

1. 配置助手以识别和使用你的天气工具
2. 助手将能够查询天气预报和警报
3. 例如，用户可以问"纽约今天的天气怎么样？"，助手会使用你的MCP服务来回答

## 使用示例

### 获取天气预报

```typescript
// 调用get-forecast工具获取纽约市的天气
// 纽约市的经纬度：40.7128, -74.006
const result = await mcpClient.invokeTool("get-forecast", {
  latitude: 40.7128,
  longitude: -74.006
});
```

### 获取天气警报

```typescript
// 调用get-alerts工具获取纽约州的天气警报
const alerts = await mcpClient.invokeTool("get-alerts", {
  state: "NY"
});
```

## 进一步开发

### 添加新工具

你可以通过以下方式为服务添加新工具：

```typescript
server.tool(
  "tool-id",                     // 工具ID
  "Tool description",            // 工具描述
  {                              // 参数定义（使用zod验证）
    param: z.string().describe("Parameter description")
  },
  async (params) => {            // 处理函数
    // 处理逻辑
    return {
      content: [{ type: "text", text: "结果" }]
    };
  }
);
```

### 添加资源

除了工具外，MCP还支持资源。你可以添加提供内容的资源：

```typescript
server.resource(
  "resource-id",
  new ResourceTemplate("resource://{param}", { list: undefined }),
  async (uri, { param }) => {
    return {
      contents: [{
        uri: uri.href,
        text: `内容示例: ${param}`
      }]
    };
  }
);
```

## 资源链接

- [Model Context Protocol官网](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [美国国家气象局API](https://api.weather.gov)

## 许可证

ISC 