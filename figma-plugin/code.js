// Figma Plugin Code - 将 Next Format Conversion 设计导入到 Figma

// 设计规范
const DESIGN_TOKENS = {
  colors: {
    primary: { r: 0.4, g: 0.494, b: 0.918 }, // #667eea
    secondary: { r: 0.463, g: 0.294, b: 0.635 }, // #764ba2
    accent: { r: 0.941, g: 0.576, b: 0.984 }, // #f093fb
    white: { r: 1, g: 1, b: 1 },
    background: { r: 0.973, g: 0.976, b: 0.980 }, // #f8f9fa
    border: { r: 0.941, g: 0.941, b: 0.941 }, // #f0f0f0
    text: { r: 0.4, g: 0.4, b: 0.4 }, // #666
    textSecondary: { r: 0.6, g: 0.6, b: 0.6 },
    success: { r: 0.322, g: 0.769, b: 0.322 }, // #52c41a
    warning: { r: 0.98, g: 0.678, b: 0.078 }, // #faad14
    error: { r: 1, g: 0.298, b: 0.298 }, // #ff4d4f
  },
  gradients: {
    background: [
      { color: { r: 0.4, g: 0.494, b: 0.918 }, position: 0 },
      { color: { r: 0.463, g: 0.294, b: 0.635 }, position: 0.5 },
      { color: { r: 0.941, g: 0.576, b: 0.984 }, position: 1 }
    ],
    title: [
      { color: { r: 0.4, g: 0.494, b: 0.918 }, position: 0 },
      { color: { r: 0.463, g: 0.294, b: 0.635 }, position: 1 }
    ]
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20
  },
  shadows: {
    card: {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.1 },
      offset: { x: 0, y: 4 },
      radius: 20,
      spread: 0
    },
    glass: {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.15 },
      offset: { x: 0, y: 8 },
      radius: 32,
      spread: 0
    }
  }
};

// 创建渐变填充
function createGradientFill(gradientStops, angle = 135) {
  const angleRad = (angle * Math.PI) / 180;
  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: [
      [Math.cos(angleRad), Math.sin(angleRad), 0],
      [-Math.sin(angleRad), Math.cos(angleRad), 0]
    ],
    gradientStops: gradientStops
  };
}

// 创建玻璃态效果
function createGlassEffect(node, opacity = 0.95) {
  node.fills = [
    {
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.white,
      opacity: opacity
    }
  ];
  node.effects = [
    {
      type: 'BACKGROUND_BLUR',
      radius: 10,
      visible: true
    },
    DESIGN_TOKENS.shadows.glass
  ];
}

// 创建标题文本
function createTitle(text, x, y) {
  const titleNode = figma.createText();
  titleNode.x = x;
  titleNode.y = y;
  titleNode.characters = text;
  
  // 加载字体
  figma.loadFontAsync({ family: "Inter", style: "Bold" }).then(() => {
    titleNode.fontName = { family: "Inter", style: "Bold" };
    titleNode.fontSize = 40;
    titleNode.fills = [createGradientFill(DESIGN_TOKENS.gradients.title)];
  });
  
  return titleNode;
}

// 创建卡片
function createCard(width, height, x, y) {
  const card = figma.createFrame();
  card.name = "Card";
  card.resize(width, height);
  card.x = x;
  card.y = y;
  card.cornerRadius = DESIGN_TOKENS.borderRadius.xl;
  
  createGlassEffect(card, 0.8);
  
  card.strokes = [{
    type: 'SOLID',
    color: { ...DESIGN_TOKENS.colors.white, a: 0.2 }
  }];
  card.strokeWeight = 1;
  
  return card;
}

// 创建标签页
function createTab(text, isActive, x, y) {
  const tab = figma.createFrame();
  tab.name = `Tab - ${text}`;
  tab.resize(160, 48);
  tab.x = x;
  tab.y = y;
  tab.cornerRadius = DESIGN_TOKENS.borderRadius.lg;
  
  if (isActive) {
    tab.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.white,
      opacity: 0.9
    }];
    tab.effects = [DESIGN_TOKENS.shadows.card];
  } else {
    tab.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.white,
      opacity: 0
    }];
  }
  
  // 添加文本
  const tabText = figma.createText();
  figma.loadFontAsync({ family: "Inter", style: "Medium" }).then(() => {
    tabText.fontName = { family: "Inter", style: "Medium" };
    tabText.fontSize = 14;
    tabText.characters = text;
    tabText.fills = [{
      type: 'SOLID',
      color: isActive ? DESIGN_TOKENS.colors.primary : DESIGN_TOKENS.colors.text
    }];
    
    // 居中文本
    tabText.x = (tab.width - tabText.width) / 2;
    tabText.y = (tab.height - tabText.height) / 2;
    
    tab.appendChild(tabText);
  });
  
  return tab;
}

// 创建按钮
function createButton(text, type, x, y) {
  const button = figma.createFrame();
  button.name = `Button - ${text}`;
  button.resize(180, 40);
  button.x = x;
  button.y = y;
  button.cornerRadius = DESIGN_TOKENS.borderRadius.md;
  
  if (type === 'primary') {
    button.fills = [createGradientFill(DESIGN_TOKENS.gradients.title)];
  } else {
    button.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.white
    }];
    button.strokes = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.border
    }];
    button.strokeWeight = 1;
  }
  
  // 添加文本
  const buttonText = figma.createText();
  figma.loadFontAsync({ family: "Inter", style: "Medium" }).then(() => {
    buttonText.fontName = { family: "Inter", style: "Medium" };
    buttonText.fontSize = 14;
    buttonText.characters = text;
    buttonText.fills = [{
      type: 'SOLID',
      color: type === 'primary' ? DESIGN_TOKENS.colors.white : DESIGN_TOKENS.colors.primary
    }];
    
    // 居中文本
    buttonText.x = (button.width - buttonText.width) / 2;
    buttonText.y = (button.height - buttonText.height) / 2;
    
    button.appendChild(buttonText);
  });
  
  return button;
}

// 创建输入框
function createInput(placeholder, x, y, width = 300) {
  const input = figma.createFrame();
  input.name = "Input";
  input.resize(width, 40);
  input.x = x;
  input.y = y;
  input.cornerRadius = DESIGN_TOKENS.borderRadius.md;
  input.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.white
  }];
  input.strokes = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.border
  }];
  input.strokeWeight = 1;
  
  // 添加占位符文本
  const placeholderText = figma.createText();
  figma.loadFontAsync({ family: "Inter", style: "Regular" }).then(() => {
    placeholderText.fontName = { family: "Inter", style: "Regular" };
    placeholderText.fontSize = 14;
    placeholderText.characters = placeholder;
    placeholderText.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.textSecondary,
      opacity: 0.5
    }];
    
    placeholderText.x = DESIGN_TOKENS.spacing.md;
    placeholderText.y = (input.height - placeholderText.height) / 2;
    
    input.appendChild(placeholderText);
  });
  
  return input;
}

// 创建进度条
function createProgressBar(percent, x, y, width = 300) {
  const container = figma.createFrame();
  container.name = "Progress Bar";
  container.resize(width, 8);
  container.x = x;
  container.y = y;
  container.cornerRadius = 4;
  container.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.background
  }];
  
  // 进度条填充
  const fill = figma.createFrame();
  fill.name = "Progress Fill";
  fill.resize(width * (percent / 100), 8);
  fill.cornerRadius = 4;
  fill.fills = [createGradientFill(DESIGN_TOKENS.gradients.title)];
  
  container.appendChild(fill);
  
  return container;
}

// 主函数
async function main() {
  // 创建主页面框架
  const page = figma.createFrame();
  page.name = "多媒体格式转换工具";
  page.resize(1200, 1400);
  page.x = 0;
  page.y = 0;
  
  // 背景渐变
  page.fills = [createGradientFill(DESIGN_TOKENS.gradients.background)];
  
  // 背景装饰圆
  const decorCircle1 = figma.createEllipse();
  decorCircle1.resize(500, 500);
  decorCircle1.x = 900;
  decorCircle1.y = -50;
  decorCircle1.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.white,
    opacity: 0.1
  }];
  decorCircle1.effects = [{
    type: 'LAYER_BLUR',
    radius: 100,
    visible: true
  }];
  page.appendChild(decorCircle1);
  
  const decorCircle2 = figma.createEllipse();
  decorCircle2.resize(400, 400);
  decorCircle2.x = -100;
  decorCircle2.y = 1000;
  decorCircle2.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.white,
    opacity: 0.05
  }];
  decorCircle2.effects = [{
    type: 'LAYER_BLUR',
    radius: 80,
    visible: true
  }];
  page.appendChild(decorCircle2);
  
  // 主内容容器
  const mainContainer = figma.createFrame();
  mainContainer.name = "Main Container";
  mainContainer.resize(1100, 1200);
  mainContainer.x = 50;
  mainContainer.y = 100;
  mainContainer.cornerRadius = DESIGN_TOKENS.borderRadius.xxl;
  createGlassEffect(mainContainer, 0.95);
  page.appendChild(mainContainer);
  
  // 标题
  const title = createTitle("多媒体格式转换工具", 0, 40);
  title.x = (mainContainer.width - title.width) / 2;
  mainContainer.appendChild(title);
  
  // 标签页卡片
  const tabCard = createCard(1050, 900, 25, 140);
  mainContainer.appendChild(tabCard);
  
  // 标签页容器
  const tabContainer = figma.createFrame();
  tabContainer.name = "Tab Container";
  tabContainer.resize(1050, 60);
  tabContainer.x = 0;
  tabContainer.y = 0;
  tabContainer.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.background,
    opacity: 0.8
  }];
  tabContainer.cornerRadius = DESIGN_TOKENS.borderRadius.xl;
  
  // 创建标签页
  const tabs = [
    "GIF 转 WebP",
    "MP4 压缩",
    "GIF 转 MP4",
    "MP4 获取首帧",
    "图片压缩",
    "GIF 压缩",
    "AI 图像生成"
  ];
  
  let tabX = 20;
  tabs.forEach((tabText, index) => {
    const tab = createTab(tabText, index === 0, tabX, 6);
    tabContainer.appendChild(tab);
    tabX += 170;
  });
  
  tabCard.appendChild(tabContainer);
  
  // 内容区域
  const contentArea = figma.createFrame();
  contentArea.name = "Content Area";
  contentArea.resize(1000, 780);
  contentArea.x = 25;
  contentArea.y = 90;
  contentArea.fills = [];
  
  // 上传区域卡片
  const uploadCard = createCard(950, 120, 0, 0);
  const uploadTitle = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "SemiBold" });
  uploadTitle.fontName = { family: "Inter", style: "SemiBold" };
  uploadTitle.fontSize = 16;
  uploadTitle.characters = "上传 GIF 文件";
  uploadTitle.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.text
  }];
  uploadTitle.x = 20;
  uploadTitle.y = 20;
  uploadCard.appendChild(uploadTitle);
  
  // 上传按钮
  const uploadButton = createButton("选择多个 GIF 文件", "primary", 20, 60);
  uploadCard.appendChild(uploadButton);
  
  contentArea.appendChild(uploadCard);
  
  // 文件列表卡片
  const fileListCard = createCard(950, 300, 0, 150);
  const fileListTitle = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "SemiBold" });
  fileListTitle.fontName = { family: "Inter", style: "SemiBold" };
  fileListTitle.fontSize = 16;
  fileListTitle.characters = "已上传文件 (3)";
  fileListTitle.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.text
  }];
  fileListTitle.x = 20;
  fileListTitle.y = 20;
  fileListCard.appendChild(fileListTitle);
  
  // 文件项示例
  let fileY = 60;
  for (let i = 0; i < 3; i++) {
    const fileItem = figma.createFrame();
    fileItem.name = `File Item ${i + 1}`;
    fileItem.resize(900, 60);
    fileItem.x = 25;
    fileItem.y = fileY;
    fileItem.fills = [];
    fileItem.strokes = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.border
    }];
    fileItem.strokeWeight = 1;
    fileItem.strokeAlign = 'INSIDE';
    
    // 文件名
    const fileName = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    fileName.fontName = { family: "Inter", style: "Regular" };
    fileName.fontSize = 14;
    fileName.characters = `example-${i + 1}.gif`;
    fileName.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.text
    }];
    fileName.x = 10;
    fileName.y = 10;
    fileItem.appendChild(fileName);
    
    // 状态标签
    const statusTag = figma.createFrame();
    statusTag.name = "Status Tag";
    statusTag.resize(80, 24);
    statusTag.x = 10;
    statusTag.y = 32;
    statusTag.cornerRadius = 4;
    statusTag.fills = [{
      type: 'SOLID',
      color: i === 0 ? DESIGN_TOKENS.colors.success : (i === 1 ? { r: 1, g: 0.647, b: 0 } : DESIGN_TOKENS.colors.primary)
    }];
    
    const statusText = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    statusText.fontName = { family: "Inter", style: "Medium" };
    statusText.fontSize = 12;
    statusText.characters = i === 0 ? "压缩成功" : (i === 1 ? "压缩中" : "已上传");
    statusText.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.white
    }];
    statusText.x = (statusTag.width - statusText.width) / 2;
    statusText.y = (statusTag.height - statusText.height) / 2;
    statusTag.appendChild(statusText);
    fileItem.appendChild(statusTag);
    
    // 进度条（仅对压缩中的文件）
    if (i === 1) {
      const progress = createProgressBar(70, 100, 35, 200);
      fileItem.appendChild(progress);
    }
    
    // 操作按钮
    const downloadBtn = createButton(i === 0 ? "下载" : "删除", i === 0 ? "default" : "default", 750, 10);
    downloadBtn.resize(120, 32);
    fileItem.appendChild(downloadBtn);
    
    fileListCard.appendChild(fileItem);
    fileY += 70;
  }
  
  contentArea.appendChild(fileListCard);
  
  // 配置卡片
  const configCard = createCard(950, 250, 0, 480);
  const configTitle = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "SemiBold" });
  configTitle.fontName = { family: "Inter", style: "SemiBold" };
  configTitle.fontSize = 16;
  configTitle.characters = "压缩配置";
  configTitle.fills = [{
    type: 'SOLID',
    color: DESIGN_TOKENS.colors.text
  }];
  configTitle.x = 20;
  configTitle.y = 20;
  configCard.appendChild(configTitle);
  
  // 配置项示例
  const configItems = [
    { label: "质量 (30)", y: 60 },
    { label: "颜色数量 (256)", y: 110 },
    { label: "压缩效率 (10)", y: 160 }
  ];
  
  for (const item of configItems) {
    const label = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    label.fontName = { family: "Inter", style: "Medium" };
    label.fontSize = 14;
    label.characters = item.label;
    label.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.text
    }];
    label.x = 30;
    label.y = item.y;
    configCard.appendChild(label);
    
    // 滑块轨道
    const sliderTrack = figma.createFrame();
    sliderTrack.name = "Slider Track";
    sliderTrack.resize(800, 4);
    sliderTrack.x = 30;
    sliderTrack.y = item.y + 25;
    sliderTrack.cornerRadius = 2;
    sliderTrack.fills = [{
      type: 'SOLID',
      color: DESIGN_TOKENS.colors.border
    }];
    configCard.appendChild(sliderTrack);
    
    // 滑块填充
    const sliderFill = figma.createFrame();
    sliderFill.name = "Slider Fill";
    sliderFill.resize(240, 4);
    sliderFill.cornerRadius = 2;
    sliderFill.fills = [createGradientFill(DESIGN_TOKENS.gradients.title)];
    sliderTrack.appendChild(sliderFill);
  }
  
  contentArea.appendChild(configCard);
  
  // 操作按钮区域
  const actionButton = createButton("批量压缩 GIF", "primary", 0, 750);
  actionButton.resize(450, 48);
  contentArea.appendChild(actionButton);
  
  const downloadAllButton = createButton("下载全部", "default", 470, 750);
  downloadAllButton.resize(450, 48);
  contentArea.appendChild(downloadAllButton);
  
  tabCard.appendChild(contentArea);
  
  // 将页面添加到当前页面
  figma.currentPage.appendChild(page);
  
  // 选中创建的框架
  figma.currentPage.selection = [page];
  figma.viewport.scrollAndZoomIntoView([page]);
  
  // 通知用户
  figma.notify('✅ 设计已成功导入到 Figma！');
  
  // 关闭插件
  figma.closePlugin();
}

// 运行主函数
main().catch(error => {
  console.error('Error:', error);
  figma.notify('❌ 导入失败: ' + error.message);
  figma.closePlugin();
});
