#!/bin/bash

# 一键启动脚本 - 多媒体格式转换工具

echo "===================================="
echo "多媒体格式转换工具一键启动脚本"
echo "===================================="

# 检查Node.js版本
echo "\n1. 检查Node.js版本..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✓ Node.js版本: $NODE_VERSION"
    
    # 检查Node.js版本是否满足要求
    if [[ "$NODE_VERSION" =~ ^v([0-9]+)\. ]]; then
        NODE_MAJOR_VERSION=${BASH_REMATCH[1]}
        if (( NODE_MAJOR_VERSION < 16 )); then
            echo "⚠ 警告: Node.js版本建议16+，当前版本可能不兼容"
        fi
    fi
else
    echo "✗ 错误: 未安装Node.js，请先安装Node.js 16+"
    exit 1
fi

# 检查npm版本
echo "\n2. 检查npm版本..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✓ npm版本: $NPM_VERSION"
else
    echo "✗ 错误: 未安装npm"
    exit 1
fi

# 安装依赖
echo "\n3. 安装项目依赖..."
if [ -f "package.json" ]; then
    echo "正在安装依赖..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✓ 依赖安装成功"
    else
        echo "✗ 错误: 依赖安装失败"
        echo "尝试使用 --legacy-peer-deps 选项..."
        npm install --legacy-peer-deps
        if [ $? -eq 0 ]; then
            echo "✓ 依赖安装成功"
        else
            echo "✗ 错误: 依赖安装失败，请检查网络连接"
            exit 1
        fi
    fi
else
    echo "✗ 错误: 未找到package.json文件"
    exit 1
fi

# 启动开发服务器
echo "\n4. 启动开发服务器..."
echo "正在启动开发服务器..."
echo "===================================="
echo "开发服务器启动后，将在浏览器中访问: http://localhost:3000"
echo "按 Ctrl+C 停止服务器"
echo "===================================="

npm run dev
