const { idiomKnowledge, idiomQuestions } = require("./materials/idioms");
const { connectiveKnowledge, connectiveQuestions } = require("./materials/connectives");

const modules = [
  {
    id: "verbal",
    name: "言语模块",
    description: "成语、关联词、诗词与实词辨析",
    symbol: "言"
  },
  {
    id: "math",
    name: "数量关系",
    description: "公式、方法与题型要点",
    symbol: "数"
  },
  {
    id: "common",
    name: "常识理论",
    description: "政治理论与公共基础知识",
    symbol: "识"
  }
];

const topics = [
  {
    id: "idiom",
    moduleId: "verbal",
    name: "成语",
    description: "四字成语的释义、语境与易错用法",
    symbol: "成",
    groupSize: 20
  },
  {
    id: "poetry",
    moduleId: "verbal",
    name: "诗词",
    description: "名句、作者与篇目对应",
    symbol: "诗",
    groupSize: 20
  },
  {
    id: "connective",
    moduleId: "verbal",
    name: "关联词",
    description: "逻辑关系、指代词与文段标志",
    symbol: "联",
    groupSize: 20
  },
  {
    id: "word",
    moduleId: "verbal",
    name: "实词",
    description: "古汉语常见词义与语境辨析",
    symbol: "词",
    groupSize: 20
  },
  {
    id: "formula",
    moduleId: "math",
    name: "公式",
    description: "工程、行程等数量关系基础公式",
    symbol: "式",
    groupSize: 20
  },
  {
    id: "theory",
    moduleId: "common",
    name: "理论",
    description: "政治理论与哲学基础概念",
    symbol: "理",
    groupSize: 20
  }
];

const baseKnowledge = [
  {
    id: "k-idiom-001",
    moduleId: "verbal",
    topicId: "idiom",
    title: "不刊之论",
    summary: "不能改动或不可磨灭的言论，形容正确而不可推翻的言论。",
    detail: "“刊”在这里是削除、修改的意思。这个成语通常用来评价观点或文章正确、精当，不表示“不能刊登”。",
    memory: "刊＝修改；不刊＝无须修改。",
    tags: ["易望文生义", "褒义"]
  },
  {
    id: "k-idiom-002",
    moduleId: "verbal",
    topicId: "idiom",
    title: "首当其冲",
    summary: "先回想它的含义，再点击查看材料释义。",
    detail: "首先受到冲击、攻击或首先遭受灾难",
    memory: "",
    source: "成语.pptx 备注",
    tags: ["材料导入", "PPT备注"]
  },
  {
    id: "k-idiom-003",
    moduleId: "verbal",
    topicId: "idiom",
    title: "差强人意",
    summary: "大体上还能使人满意。",
    detail: "“差”是稍微、大体的意思；“强”是振奋。它表达的是尚可、基本满意，不是“让人很不满意”。",
    memory: "差＝大体，结果尚可。",
    tags: ["易误用", "中性"]
  },
  {
    id: "k-poetry-001",
    moduleId: "verbal",
    topicId: "poetry",
    title: "大漠孤烟直",
    summary: "出自王维《使至塞上》，下一句是“长河落日圆”。",
    detail: "诗句描绘了边塞广阔苍茫的景象。“直”与“圆”形成鲜明的视觉对照。",
    memory: "王维边塞：大漠—孤烟直，长河—落日圆。",
    tags: ["王维", "使至塞上"]
  },
  {
    id: "k-poetry-002",
    moduleId: "verbal",
    topicId: "poetry",
    title: "会当凌绝顶",
    summary: "出自杜甫《望岳》，下一句是“一览众山小”。",
    detail: "“会当”表示终当、一定要。全句表现诗人登临绝顶、俯瞰群山的壮志。",
    memory: "杜甫《望岳》：会当凌绝顶，一览众山小。",
    tags: ["杜甫", "望岳"]
  },
  {
    id: "k-word-001",
    moduleId: "verbal",
    topicId: "word",
    title: "谢",
    summary: "常见义项包括道歉、辞别、拒绝、感谢、凋谢。",
    detail: "古汉语中要结合语境判断。“乃令张良留谢”中的“谢”表示辞谢、辞别；“哙拜谢”中的“谢”表示感谢。",
    memory: "谢的核心语感是以言语表达回应，再按语境区分。",
    tags: ["古汉语", "多义词"]
  },
  {
    id: "k-word-002",
    moduleId: "verbal",
    topicId: "word",
    title: "诚",
    summary: "常见义项包括真诚、确实、果真。",
    detail: "作形容词时常表示真诚；作副词时常表示确实、的确，如“臣诚知不如徐公美”。",
    memory: "形容品质是真诚，修饰判断是确实。",
    tags: ["古汉语", "词性辨析"]
  },
  {
    id: "k-formula-001",
    moduleId: "math",
    topicId: "formula",
    title: "工程问题基本公式",
    summary: "工作总量＝工作效率×工作时间。",
    detail: "当工作总量没有给出具体数值时，可以设为单位“1”，再根据各自完成时间求效率。例如甲单独6天完成，则甲的效率为1/6。",
    memory: "总量、效率、时间三者知二求一。",
    tags: ["数量关系", "工程问题"]
  },
  {
    id: "k-formula-002",
    moduleId: "math",
    topicId: "formula",
    title: "行程问题基本公式",
    summary: "路程＝速度×时间。",
    detail: "相遇问题常使用速度和；追及问题常使用速度差。计算前要统一路程、速度和时间的单位。",
    memory: "相遇用和，追及用差。",
    tags: ["数量关系", "行程问题"]
  },
  {
    id: "k-theory-001",
    moduleId: "common",
    topicId: "theory",
    title: "实践与认识",
    summary: "实践是认识的来源、动力、目的，也是检验认识真理性的唯一标准。",
    detail: "认识来源于实践，又反过来指导实践。不能把书本知识本身视为认识的最终来源。",
    memory: "来源、动力、目的、检验标准。",
    tags: ["马克思主义哲学", "认识论"]
  },
  {
    id: "k-theory-002",
    moduleId: "common",
    topicId: "theory",
    title: "矛盾的普遍性",
    summary: "矛盾存在于一切事物的发展过程中，并贯穿每一事物发展过程的始终。",
    detail: "承认矛盾的普遍性，要求我们敢于承认矛盾、分析矛盾，并寻找正确方法解决矛盾。",
    memory: "事事有矛盾，时时有矛盾。",
    tags: ["马克思主义哲学", "辩证法"]
  }
];

const baseQuestions = [
  {
    id: "q-idiom-001",
    moduleId: "verbal",
    topicId: "idiom",
    knowledgeId: "k-idiom-001",
    stem: "下列对“不刊之论”的解释，正确的是：",
    options: [
      { id: "A", text: "不能公开刊登的言论" },
      { id: "B", text: "正确而不可推翻的言论" },
      { id: "C", text: "尚未发表的个人意见" },
      { id: "D", text: "内容过时的文章" }
    ],
    answer: "B",
    explanation: "“刊”是削除、修改的意思。“不刊之论”指正确而不可修改、不可推翻的言论。"
  },
  {
    id: "q-idiom-002",
    moduleId: "verbal",
    topicId: "idiom",
    knowledgeId: "k-idiom-002",
    stem: "按照材料备注，“首当其冲”最恰当的含义是：",
    options: [
      { id: "A", text: "第一个向前冲锋" },
      { id: "B", text: "首先获得成功" },
      { id: "C", text: "首先受到冲击、攻击或首先遭受灾难" },
      { id: "D", text: "处在队伍最前方" }
    ],
    answer: "C",
    explanation: "材料备注释义：首先受到冲击、攻击或首先遭受灾难"
  },
  {
    id: "q-idiom-003",
    moduleId: "verbal",
    topicId: "idiom",
    knowledgeId: "k-idiom-003",
    stem: "“差强人意”通常用来表示：",
    options: [
      { id: "A", text: "结果完全不能让人满意" },
      { id: "B", text: "结果大体上还能让人满意" },
      { id: "C", text: "必须强迫别人接受" },
      { id: "D", text: "人与人之间差距很大" }
    ],
    answer: "B",
    explanation: "“差强人意”表示大体上还能使人满意，语义比“非常满意”弱。"
  },
  {
    id: "q-poetry-001",
    moduleId: "verbal",
    topicId: "poetry",
    knowledgeId: "k-poetry-001",
    stem: "“大漠孤烟直，长河落日圆”出自：",
    options: [
      { id: "A", text: "王维《使至塞上》" },
      { id: "B", text: "杜甫《望岳》" },
      { id: "C", text: "王昌龄《出塞》" },
      { id: "D", text: "岑参《白雪歌送武判官归京》" }
    ],
    answer: "A",
    explanation: "“大漠孤烟直，长河落日圆”出自王维的《使至塞上》。"
  },
  {
    id: "q-poetry-002",
    moduleId: "verbal",
    topicId: "poetry",
    knowledgeId: "k-poetry-002",
    stem: "“会当凌绝顶，一览众山小”出自：",
    options: [
      { id: "A", text: "李白《望庐山瀑布》" },
      { id: "B", text: "杜甫《望岳》" },
      { id: "C", text: "王维《终南别业》" },
      { id: "D", text: "孟浩然《春晓》" }
    ],
    answer: "B",
    explanation: "“会当凌绝顶，一览众山小”出自杜甫《望岳》。"
  },
  {
    id: "q-word-001",
    moduleId: "verbal",
    topicId: "word",
    knowledgeId: "k-word-001",
    stem: "“乃令张良留谢”中“谢”的含义是：",
    options: [
      { id: "A", text: "感谢" },
      { id: "B", text: "凋谢" },
      { id: "C", text: "辞谢、辞别" },
      { id: "D", text: "道歉" }
    ],
    answer: "C",
    explanation: "结合语境，此处表示留下张良向项王辞谢、告辞。"
  },
  {
    id: "q-word-002",
    moduleId: "verbal",
    topicId: "word",
    knowledgeId: "k-word-002",
    stem: "“臣诚知不如徐公美”中“诚”的含义是：",
    options: [
      { id: "A", text: "真诚的品格" },
      { id: "B", text: "确实、的确" },
      { id: "C", text: "如果" },
      { id: "D", text: "诚恳地请求" }
    ],
    answer: "B",
    explanation: "“诚”在这里作副词，表示确实、的确。"
  },
  {
    id: "q-formula-001",
    moduleId: "math",
    topicId: "formula",
    knowledgeId: "k-formula-001",
    stem: "工程问题中，工作总量、效率和时间的基本关系是：",
    options: [
      { id: "A", text: "工作总量＝工作效率＋工作时间" },
      { id: "B", text: "工作总量＝工作效率÷工作时间" },
      { id: "C", text: "工作总量＝工作效率×工作时间" },
      { id: "D", text: "工作总量＝工作时间÷工作效率" }
    ],
    answer: "C",
    explanation: "工程问题的基本公式是工作总量＝工作效率×工作时间。"
  },
  {
    id: "q-formula-002",
    moduleId: "math",
    topicId: "formula",
    knowledgeId: "k-formula-002",
    stem: "两人从相距一定距离的两地同时相向而行，求相遇时间通常应使用：",
    options: [
      { id: "A", text: "距离÷两人速度和" },
      { id: "B", text: "距离÷两人速度差" },
      { id: "C", text: "距离×两人速度和" },
      { id: "D", text: "距离×两人速度差" }
    ],
    answer: "A",
    explanation: "相向而行时，双方共同缩短距离，因此相遇时间＝初始距离÷速度和。"
  },
  {
    id: "q-theory-001",
    moduleId: "common",
    topicId: "theory",
    knowledgeId: "k-theory-001",
    stem: "检验认识是否具有真理性的唯一标准是：",
    options: [
      { id: "A", text: "权威观点" },
      { id: "B", text: "逻辑推演" },
      { id: "C", text: "社会实践" },
      { id: "D", text: "多数人的意见" }
    ],
    answer: "C",
    explanation: "实践是检验认识真理性的唯一标准。"
  },
  {
    id: "q-theory-002",
    moduleId: "common",
    topicId: "theory",
    knowledgeId: "k-theory-002",
    stem: "“事事有矛盾，时时有矛盾”体现的是：",
    options: [
      { id: "A", text: "矛盾的特殊性" },
      { id: "B", text: "矛盾的普遍性" },
      { id: "C", text: "矛盾双方的同一性" },
      { id: "D", text: "量变与质变的关系" }
    ],
    answer: "B",
    explanation: "矛盾存在于一切事物及其发展过程的始终，体现矛盾的普遍性。"
  }
];

const existingIdiomTitles = new Set(
  baseKnowledge
    .filter((item) => item.topicId === "idiom")
    .map((item) => item.title)
);
const importedIdioms = idiomKnowledge.filter(
  (item) => !existingIdiomTitles.has(item.title)
);
const importedIdiomIds = new Set(importedIdioms.map((item) => item.id));

const knowledge = [
  ...baseKnowledge,
  ...importedIdioms,
  ...connectiveKnowledge
];

const questions = [
  ...baseQuestions,
  ...idiomQuestions.filter((item) => importedIdiomIds.has(item.knowledgeId)),
  ...connectiveQuestions
];

function getModuleById(id) {
  return modules.find((item) => item.id === id);
}

function getTopicById(id) {
  return topics.find((item) => item.id === id);
}

function getModuleName(id) {
  const module = getModuleById(id);
  return module ? module.name : "未分类模块";
}

function getTopicName(id) {
  const topic = getTopicById(id);
  return topic ? topic.name : "未分类";
}

function getTopicsByModule(moduleId) {
  return topics.filter((item) => item.moduleId === moduleId);
}

function getKnowledgeByTopic(topicId) {
  return knowledge.filter((item) => item.topicId === topicId);
}

function getQuestionsByTopic(topicId) {
  return questions.filter((item) => item.topicId === topicId);
}

function getKnowledgeById(id) {
  return knowledge.find((item) => item.id === id);
}

function getQuestionById(id) {
  return questions.find((item) => item.id === id);
}

function getSetsForTopic(topicId) {
  const topic = getTopicById(topicId);
  const items = getKnowledgeByTopic(topicId);
  const groupSize = topic ? topic.groupSize : 20;
  const count = Math.ceil(items.length / groupSize);
  return Array.from({ length: count }, (_, index) => {
    const start = index * groupSize;
    const end = Math.min(start + groupSize, items.length);
    return {
      index,
      name: `第${index + 1}组`,
      start: start + 1,
      end,
      count: end - start,
      items: items.slice(start, end)
    };
  });
}

function getKnowledgeSet(topicId, setIndex) {
  const sets = getSetsForTopic(topicId);
  const selectedSet = sets[Number(setIndex)];
  return selectedSet || null;
}

module.exports = {
  modules,
  topics,
  categories: topics,
  knowledge,
  questions,
  getModuleById,
  getTopicById,
  getModuleName,
  getTopicName,
  getCategoryName: getTopicName,
  getTopicsByModule,
  getKnowledgeByTopic,
  getQuestionsByTopic,
  getKnowledgeById,
  getQuestionById,
  getSetsForTopic,
  getKnowledgeSet
};
