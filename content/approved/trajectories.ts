export type ApprovedTrajectoryId =
  | "llm_architecture"
  | "multimodal_architecture"
  | "provider_releases"
  | "commercial_forces";

export type ApprovedTrajectoryPrimer = {
  id: ApprovedTrajectoryId;
  title: string;
  primer: string;
  watchQuestions: string[];
};

export const approvedTrajectoryPrimers: Record<ApprovedTrajectoryId, ApprovedTrajectoryPrimer> = {
  llm_architecture: {
    id: "llm_architecture",
    title: "LLM 架构演进",
    primer:
      "追踪语言模型如何从 Transformer、预训练、提示学习走向更长上下文、更低推理成本和可能的混合架构。重点不是单个模型有多聪明，而是能力、成本和可扩展性之间的工程交换。",
    watchQuestions: [
      "新架构是否在真实工作负载中降低训练或推理成本？",
      "上下文长度、检索、工具调用和记忆机制如何改变模型边界？",
      "评测提升来自架构、数据、规模还是产品调优？"
    ]
  },
  multimodal_architecture: {
    id: "multimodal_architecture",
    title: "多模态架构",
    primer:
      "追踪文本、图像、音频、视频和动作如何进入统一系统。CLIP 与扩散模型说明，多模态进展常来自表示对齐、生成过程和数据管线的组合，而不只是多接一个输入端。",
    watchQuestions: [
      "模型是在理解多模态，还是只把不同模态串接到同一产品里？",
      "生成质量、可控性、版权和安全过滤之间如何取舍？",
      "多模态能力是否改变了用户工作流，而不只是演示效果？"
    ]
  },
  provider_releases: {
    id: "provider_releases",
    title: "供应商发布与开放策略",
    primer:
      "追踪 OpenAI、Meta、Google、Anthropic、Stability AI 等供应商如何通过 API、产品、开放权重、系统卡和开发者工具定义市场入口。发布策略本身会改变生态结构。",
    watchQuestions: [
      "发布的是论文、API、产品、权重，还是完整开发平台？",
      "许可和可部署性是否允许企业形成替代供应链？",
      "供应商是否把评测、安全和价格作为同等重要的发布信息？"
    ]
  },
  commercial_forces: {
    id: "commercial_forces",
    title: "商业力量与基础设施约束",
    primer:
      "追踪用户采用、资本开支、GPU 供给、云平台合作、价格和监管如何反向塑造技术路线。AI 进展不是纯研究曲线，商业压力会决定哪些问题被优先解决。",
    watchQuestions: [
      "需求增长是否转化为芯片、数据中心和能源约束？",
      "成本下降来自算法效率、硬件换代、规模采购还是商业补贴？",
      "产品采用是否正在改变模型训练、对齐和推理优化的优先级？"
    ]
  }
};

export const approvedTrajectoryPrimerList = Object.values(approvedTrajectoryPrimers);
