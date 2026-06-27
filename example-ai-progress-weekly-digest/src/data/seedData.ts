import { Event, WeeklyBrief, CausalLink } from '../types';

export const SEED_EVENTS: Event[] = [
  {
    id: 'ev-mamba',
    title: 'Mamba 用选择性状态空间挑战注意力成本',
    date: '2023-12-01',
    type: 'architecture',
    summary: 'Mamba 提出选择性状态空间模型和硬件感知算法，在长序列场景中以线性复杂度替代部分注意力计算。',
    why_it_matters: '它显示 Transformer 并非终局；当上下文长度、推理成本和吞吐成为瓶颈时，架构搜索会围绕硬件效率重新活跃。',
    trajectories: ['llm_architecture'],
    providers: ['Carnegie Mellon University', 'Princeton University'],
    confidence: 'observed',
    watchlist: true,
    sources: [
      { title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces', url: 'https://arxiv.org/abs/2312.00752', category: 'Paper' }
    ],
    causal_links: ['cl-transformer-mamba']
  },
  {
    id: 'ev-nvidia-demand-surge',
    title: 'NVIDIA 财报显示生成式 AI 需求转化为数据中心收入',
    date: '2023-08-23',
    type: 'business',
    summary: 'NVIDIA 公布 FY2024 Q2 财报，营收和数据中心收入创纪录，并将增长归因于加速计算和生成式 AI 采用。',
    why_it_matters: '这标志着模型热潮进入资本开支和供应链层面：谁能获得 GPU、网络和云容量，开始影响技术路线和产品节奏。',
    trajectories: ['commercial_forces'],
    providers: ['NVIDIA'],
    confidence: 'observed',
    watchlist: true,
    sources: [
      { title: 'NVIDIA Announces Financial Results for Second Quarter Fiscal 2024', url: 'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2024', category: 'Company' }
    ],
    causal_links: ['cl-chatgpt-nvidia-demand']
  },
  {
    id: 'ev-llama2',
    title: 'Llama 2 让开放权重 LLM 进入商业使用阶段',
    date: '2023-07-18',
    type: 'model_release',
    summary: 'Meta 发布 Llama 2，提供预训练和聊天微调模型权重，并允许研究和许多商业使用场景。',
    why_it_matters: 'Llama 2 改变了闭源 API 与开放权重之间的竞争结构，让企业、研究者和云厂商能围绕可下载模型建立替代生态。',
    trajectories: ['llm_architecture', 'provider_releases', 'commercial_forces'],
    providers: ['Meta'],
    confidence: 'observed',
    watchlist: true,
    sources: [
      { title: 'Meta and Microsoft Introduce the Next Generation of Llama', url: 'https://ai.meta.com/blog/llama-2/', category: 'Company' },
      { title: 'Llama 2: Open Foundation and Fine-Tuned Chat Models', url: 'https://arxiv.org/abs/2307.09288', category: 'Paper' }
    ]
  },
  {
    id: 'ev-gpt4',
    title: 'GPT-4 发布并展示大规模多模态模型路线',
    date: '2023-03-14',
    type: 'model_release',
    summary: 'OpenAI 发布 GPT-4，称其可接受图像和文本输入，并在多个专业与学术基准上显著超过 GPT-3.5。',
    why_it_matters: 'GPT-4 将规模化、对齐、评测、系统卡和产品接入打包为发布范式，推动模型发布从单点指标转向完整系统能力。',
    trajectories: ['llm_architecture', 'multimodal_architecture', 'provider_releases'],
    providers: ['OpenAI'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'GPT-4', url: 'https://openai.com/index/gpt-4-research/', category: 'Company' },
      { title: 'GPT-4 Technical Report', url: 'https://arxiv.org/abs/2303.08774', category: 'Paper' }
    ]
  },
  {
    id: 'ev-chatgpt',
    title: 'ChatGPT 把对话式 LLM 带入大众产品周期',
    date: '2022-11-30',
    type: 'product',
    summary: 'OpenAI 发布 ChatGPT 研究预览，把基于 RLHF 的对话模型以免费产品形式交给大众用户试用。',
    why_it_matters: 'ChatGPT 让 LLM 的价值从论文和 API 迁移到日常任务，触发企业采购、竞品发布、推理成本和安全评测的连锁反应。',
    trajectories: ['provider_releases', 'commercial_forces'],
    providers: ['OpenAI'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'Introducing ChatGPT', url: 'https://openai.com/index/chatgpt/', category: 'Company' }
    ],
    causal_links: ['cl-chatgpt-nvidia-demand']
  },
  {
    id: 'ev-stable-diffusion',
    title: 'Stable Diffusion 开放权重推动图像生成生态爆发',
    date: '2022-08-22',
    type: 'model_release',
    summary: 'Stability AI 公开发布 Stable Diffusion 权重、模型卡和代码入口，使高质量文本到图像生成可在本地和社区工具中扩展。',
    why_it_matters: '开放权重让扩散模型从少数云端产品变成可改造生态，催生插件、微调、LoRA、工作流工具和创作者市场。',
    trajectories: ['multimodal_architecture', 'provider_releases', 'commercial_forces'],
    providers: ['Stability AI', 'CompVis', 'Runway'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'Stable Diffusion Public Release', url: 'https://stability.ai/news/stable-diffusion-public-release', category: 'Company' }
    ],
    causal_links: ['cl-ddpm-stable-diffusion']
  },
  {
    id: 'ev-h100',
    title: 'NVIDIA H100/Hopper 面向 Transformer 训练和推理',
    date: '2022-03-22',
    type: 'infra',
    summary: 'NVIDIA 发布 Hopper 架构和 H100 GPU，加入 Transformer Engine、HBM3、NVLink 扩展等面向大模型的能力。',
    why_it_matters: 'H100 把 Transformer 工作负载明确写进硬件路线，说明模型架构已经开始反向塑造芯片、网络和数据中心设计。',
    trajectories: ['llm_architecture', 'commercial_forces'],
    providers: ['NVIDIA'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'NVIDIA Announces Hopper Architecture, the Next Generation of Accelerated Computing', url: 'https://nvidianews.nvidia.com/news/nvidia-announces-hopper-architecture-the-next-generation-of-accelerated-computing', category: 'Company' }
    ]
  },
  {
    id: 'ev-clip',
    title: 'CLIP 将文本和图像放进同一个语义空间',
    date: '2021-01-05',
    type: 'architecture',
    summary: 'OpenAI 发布 CLIP，用自然语言监督训练图文对齐模型，并展示零样本图像分类能力。',
    why_it_matters: 'CLIP 证明互联网规模图文对可以形成通用视觉语义接口，后来成为文本到图像检索、打分和控制的重要组件。',
    trajectories: ['multimodal_architecture'],
    providers: ['OpenAI'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'CLIP: Connecting text and images', url: 'https://openai.com/index/clip/', category: 'Company' },
      { title: 'Learning Transferable Visual Models From Natural Language Supervision', url: 'https://arxiv.org/abs/2103.00020', category: 'Paper' }
    ]
  },
  {
    id: 'ev-ddpm',
    title: 'DDPM 让扩散模型成为高质量生成路径',
    date: '2020-06-19',
    type: 'paper',
    summary: 'Denoising Diffusion Probabilistic Models 展示了通过逐步去噪生成高质量图像的可行路径。',
    why_it_matters: '扩散路线为后来的文本到图像系统提供了质量、稳定性和可控性的基础，改变了多模态生成的主流技术栈。',
    trajectories: ['multimodal_architecture'],
    providers: ['UC Berkeley'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'Denoising Diffusion Probabilistic Models', url: 'https://arxiv.org/abs/2006.11239', category: 'Paper' }
    ],
    causal_links: ['cl-ddpm-stable-diffusion']
  },
  {
    id: 'ev-gpt3',
    title: 'GPT-3 把少样本提示推到产业视野中心',
    date: '2020-05-28',
    type: 'paper',
    summary: 'OpenAI 发表 GPT-3 论文，展示 175B 参数自回归语言模型在少样本和零样本任务上的能力。',
    why_it_matters: 'GPT-3 把规模、提示和通用接口绑定在一起，使模型能力开始以 API 和产品平台的方式被外部开发者感知。',
    trajectories: ['llm_architecture', 'provider_releases'],
    providers: ['OpenAI'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'Language Models are Few-Shot Learners', url: 'https://arxiv.org/abs/2005.14165', category: 'Paper' }
    ],
    causal_links: ['cl-transformer-gpt3']
  },
  {
    id: 'ev-transformer',
    title: 'Transformer 以自注意力重写序列建模',
    date: '2017-06-12',
    type: 'architecture',
    summary: '《Attention Is All You Need》提出 Transformer，用自注意力替代循环和卷积，显著提升并行训练效率。',
    why_it_matters: '它把语言模型的瓶颈从逐步读序列转向可并行的注意力计算，成为后来 BERT、GPT 系列和多模态模型的共同底座。',
    trajectories: ['llm_architecture'],
    providers: ['Google'],
    confidence: 'observed',
    watchlist: false,
    sources: [
      { title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', category: 'Paper' }
    ],
    causal_links: ['cl-transformer-gpt3', 'cl-transformer-mamba']
  }
];

export const SEED_WEEKS: WeeklyBrief[] = [
  {
    id: 'week-2026-w26',
    weekStart: '2026-06-23',
    weekEnd: '2026-06-29',
    weeklyThesis: '理解 AI 进展不能只看模型发布；更稳的读法是同时追踪架构、模态、供应商策略和商业压力怎样互相推着走。',
    headlineEventIds: ['ev-transformer', 'ev-ddpm', 'ev-chatgpt', 'ev-gpt4', 'ev-nvidia-demand-surge'],
    watchlistEventIds: ['ev-llama2', 'ev-mamba'],
    closingSynthesis: '这一组历史锚点说明：技术突破会打开能力空间，产品采用会制造约束，商业资本会把约束变成下一轮基础设施和架构选择。'
  }
];

export const SEED_CAUSAL_LINKS: CausalLink[] = [
  {
    id: 'cl-transformer-gpt3',
    sourceId: 'ev-transformer',
    sourceTitle: 'Transformer 以自注意力重写序列建模',
    targetId: 'ev-gpt3',
    targetTitle: 'GPT-3 把少样本提示推到产业视野中心',
    relationshipType: 'enables',
    explanation: 'Transformer 提供了可并行、可扩展的序列建模底座，使 GPT-3 这类大规模自回归语言模型能够在规模扩展后展现少样本能力，并被外部开发者作为通用接口使用。',
    confidence: 'observed',
    sources: [
      { title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', category: 'Paper' },
      { title: 'Language Models are Few-Shot Learners', url: 'https://arxiv.org/abs/2005.14165', category: 'Paper' }
    ]
  },
  {
    id: 'cl-ddpm-stable-diffusion',
    sourceId: 'ev-ddpm',
    sourceTitle: 'DDPM 让扩散模型成为高质量生成路径',
    targetId: 'ev-stable-diffusion',
    targetTitle: 'Stable Diffusion 开放权重推动图像生成生态爆发',
    relationshipType: 'enables',
    explanation: 'DDPM 证明了逐步去噪的扩散范式可以稳定地产生高质量图像，为后来的 Stable Diffusion 提供了核心生成机制和技术基础。',
    confidence: 'observed',
    sources: [
      { title: 'Denoising Diffusion Probabilistic Models', url: 'https://arxiv.org/abs/2006.11239', category: 'Paper' },
      { title: 'Stable Diffusion Public Release', url: 'https://stability.ai/news/stable-diffusion-public-release', category: 'Company' }
    ]
  },
  {
    id: 'cl-chatgpt-nvidia-demand',
    sourceId: 'ev-chatgpt',
    sourceTitle: 'ChatGPT 把对话式 LLM 带入大众产品周期',
    targetId: 'ev-nvidia-demand-surge',
    targetTitle: 'NVIDIA 财报显示生成式 AI 需求转化为数据中心收入',
    relationshipType: 'drives',
    explanation: 'ChatGPT 将生成式 AI 推入大众产品周期后，推理调用、企业试用和产品竞争迅速放大 GPU、网络和云容量需求，进而推动 NVIDIA 数据中心收入增长。',
    confidence: 'likely',
    sources: [
      { title: 'Introducing ChatGPT', url: 'https://openai.com/index/chatgpt/', category: 'Company' },
      { title: 'NVIDIA Announces Financial Results for Second Quarter Fiscal 2024', url: 'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2024', category: 'Company' }
    ]
  },
  {
    id: 'cl-transformer-mamba',
    sourceId: 'ev-transformer',
    sourceTitle: 'Transformer 以自注意力重写序列建模',
    targetId: 'ev-mamba',
    targetTitle: 'Mamba 用选择性状态空间挑战注意力成本',
    relationshipType: 'constrains',
    explanation: 'Transformer 的注意力成本在长序列和高吞吐场景中持续上升，Mamba 正是沿着“更低复杂度、更贴合硬件”的方向回应这一约束。',
    confidence: 'observed',
    sources: [
      { title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', category: 'Paper' },
      { title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces', url: 'https://arxiv.org/abs/2312.00752', category: 'Paper' }
    ]
  }
];
