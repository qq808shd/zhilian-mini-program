const rawConnectives = [
  ["及", "并列"],
  ["必须", "对策"],
  ["这", "指代词/宏观指代词"],
  ["是…不是", "反义并列"],
  ["亟需", "对策（紧迫性）"],
  ["该", "指代词（不是对策）"],
  ["特别是", "递进"],
  ["其实", "转折；解释"],
  ["基础", "对策"],
  ["要", "对策"],
  ["才", "必要条件"],
  ["却", "转折"],
  ["呼吁", "对策"],
  ["不仅…也", "递进"],
  ["故而", "总结"],
  ["需", "对策"],
  ["除了…还", "递进"],
  ["另外", "并列"],
  ["殊不知", "转折"],
  ["不是…而是", "反义并列"],
  ["然而", "转折"],
  ["造成", "引导负面结果"],
  ["最", "递进"],
  ["提倡", "对策"],
  ["此", "指代词；宏观指代词"],
  ["甚至", "递进"],
  ["之所以…是因为…", "因果倒置"],
  ["以及", "并列"],
  ["途径", "对策"],
  ["其", "指代词"],
  ["不过", "转折"],
  ["尤其", "递进"],
  ["同时", "并列"],
  ["实际上", "转折；解释"],
  ["则", "转折"],
  ["此外", "并列"],
  ["：", "解释说明；话题引入"],
  ["相反", "反义并列"],
  ["可见", "总结"],
  ["需要", "对策"],
  ["和", "并列"],
  ["事实上", "转折；解释"],
  ["、", "并列"],
  ["反之", "反义并列"],
  ["真正", "递进"],
  ["亟待", "对策"],
  ["与此同时", "并列；引入话题"],
  ["；", "并列"],
  ["可是", "转折"],
  ["更", "递进"],
  ["与", "并列"],
  ["依托", "对策"],
  ["由于", "解释"],
  ["而且", "并列"],
  ["应", "对策"],
  ["不但…而且", "递进"],
  ["导致", "引导负面结果"],
  ["但是", "转折"],
  ["也", "并列"],
  ["因此", "总结"]
];

const overviewItems = [
  {
    title: "转折关系判断",
    detail: "前后含义相反",
    stem: "按照 Word 材料，判断转折关系的核心特征是：",
    options: ["前后含义相反", "前后含义相近、程度前轻后重", "前后含义相近且并列", "前后都提出做法"],
    answerIndex: 0
  },
  {
    title: "因果关系判断",
    detail: "前后含义相同",
    stem: "按照 Word 材料，判断因果关系的核心特征是：",
    options: ["前后含义矛盾", "前后含义相同", "前后程度逐渐减轻", "前后都是指代内容"],
    answerIndex: 1
  },
  {
    title: "递进关系判断",
    detail: "前后含义相近、程度前轻后重",
    stem: "按照 Word 材料，判断递进关系的核心特征是：",
    options: ["前后含义相反", "前后内容完全无关", "前后含义相近、程度前轻后重", "前后只表示时间顺序"],
    answerIndex: 2
  },
  {
    title: "同义并列判断",
    detail: "前后含义相近",
    stem: "按照 Word 材料，同义并列的核心特征是：",
    options: ["前后含义相近", "前后含义矛盾", "前轻后重", "前因后果"],
    answerIndex: 0
  },
  {
    title: "反义并列判断",
    detail: "前后含义矛盾",
    stem: "按照 Word 材料，反义并列的核心特征是：",
    options: ["前后含义相同", "前后含义矛盾", "前后程度相同", "前后都是对策"],
    answerIndex: 1
  },
  {
    title: "转折关系标志词",
    detail: "虽然...但是；尽管...可是；不过；然而；却；则；殊不知；其实/事实上/实际上",
    stem: "下列哪组主要是材料中的转折关系标志词？",
    options: ["此外、另外、同时", "不过、然而、却、殊不知", "因此、可见、综上所述", "应该、必须、亟待"],
    answerIndex: 1
  },
  {
    title: "因果关系标志词",
    detail: "因为...所以...；由于...因此...；因而、故而、于是、可见、看来（为什么、为何）、综上所述、使得、致使、导致、造成。均、等、都具有总结作用。特殊结构：之所以…是因为…",
    stem: "下列哪组主要是材料中的因果关系标志词？",
    options: ["因为…所以…、由于…因此…、因而、故而", "此外、另外、同时、以及", "可是、然而、却、不过", "应该、需要、亟待、建议"],
    answerIndex: 0
  },
  {
    title: "并列关系标志词",
    detail: "和、及、与、同、此外、另外、同时、以及、“；”、“、”、一方面...另一方面...",
    stem: "下列哪组主要是材料中的并列关系标志词？",
    options: ["但是、然而、却、不过", "和、及、与、此外、另外、同时、以及", "因此、可见、故而、于是", "应该、必须、需要、亟待"],
    answerIndex: 1
  },
  {
    title: "递进关系标志词",
    detail: "不但…而且、除了…还、不仅…也；更、尤其、特别是、真正、甚至、最（核心、突出）等",
    stem: "下列哪组主要是材料中的递进关系标志词？",
    options: ["不但…而且、除了…还、不仅…也", "虽然…但是、尽管…可是", "因为…所以、由于…因此", "一方面…另一方面、此外"],
    answerIndex: 0
  },
  {
    title: "对策标志词",
    detail: "应该、应当、必须、需要、亟须、亟待+做法（考查最多）；通过/采取/依托于...手段/途径/措施/方式/方法/渠道，才能...；呼吁、倡导、提倡、提醒、建议+做法；前提、基础、保障、关键、义务",
    stem: "下列哪组词最能提示文段正在提出对策？",
    options: ["应该、必须、需要、亟待、呼吁、建议", "因此、可见、综上所述", "但是、然而、殊不知", "和、及、与、同时"],
    answerIndex: 0
  },
  {
    title: "反义并列标志词",
    detail: "是，不是；不是，而是；相反；反之",
    stem: "下列哪组主要是材料中的反义并列标志词？",
    options: ["此外、另外、同时", "因此、故而、可见", "是…不是、不是…而是、相反、反之", "尤其、甚至、更"],
    answerIndex: 2
  }
];

const connectiveOverviewKnowledge = overviewItems.map((item, index) => ({
  id: `k-mat-connective-overview-${String(index + 1).padStart(3, "0")}`,
  moduleId: "verbal",
  topicId: "connective",
  title: item.title,
  summary: "先回想材料中的判断规则或标志词，再点击查看答案。",
  detail: item.detail,
  memory: "",
  source: "关联词.docx",
  tags: ["材料导入", "Word整理"]
}));

const connectiveTermKnowledge = rawConnectives.map((item, index) => ({
  id: `k-mat-connective-${String(index + 1).padStart(3, "0")}`,
  moduleId: "verbal",
  topicId: "connective",
  title: item[0],
  summary: "先判断它提示的逻辑关系或作用，再点击查看答案。",
  detail: item[1],
  memory: "",
  source: "关联词-完整版.pptx 备注",
  tags: ["材料导入", "PPT备注"]
}));

function getRelationFamily(detail) {
  if (detail.includes("反义并列")) return "反义并列";
  if (detail.includes("并列")) return "并列";
  if (detail.includes("对策")) return "对策";
  if (detail.includes("指代词")) return "指代";
  if (detail.includes("递进")) return "递进";
  if (detail.includes("转折")) return "转折";
  if (detail.includes("总结")) return "总结";
  if (detail.includes("必要条件")) return "必要条件";
  if (detail.includes("负面结果")) return "负面结果";
  if (detail.includes("因果倒置")) return "因果";
  if (detail.includes("解释")) return "解释";
  return detail;
}

function getDistractors(items, index, correct) {
  const result = [];
  const seenFamilies = new Set([getRelationFamily(correct)]);
  for (let step = 1; result.length < 3 && step <= items.length * 2; step += 1) {
    const candidate = items[(index + step * 11) % items.length].detail;
    const family = getRelationFamily(candidate);
    if (!seenFamilies.has(family)) {
      seenFamilies.add(family);
      result.push(candidate);
    }
  }
  return result;
}

function buildConnectiveQuestions(items) {
  const letters = ["A", "B", "C", "D"];
  return items.map((item, index) => {
    const answerIndex = index % letters.length;
    const optionTexts = getDistractors(items, index, item.detail);
    optionTexts.splice(answerIndex, 0, item.detail);
    return {
      id: `q-mat-connective-${String(index + 1).padStart(3, "0")}`,
      moduleId: "verbal",
      topicId: "connective",
      knowledgeId: item.id,
      stem: `按照材料备注，“${item.title}”通常提示哪种关系或作用？`,
      options: optionTexts.map((text, optionIndex) => ({
        id: letters[optionIndex],
        text
      })),
      answer: letters[answerIndex],
      explanation: `材料备注归纳为：${item.detail}`
    };
  });
}

const letters = ["A", "B", "C", "D"];
const connectiveOverviewQuestions = overviewItems.map((item, index) => ({
  id: `q-mat-connective-overview-${String(index + 1).padStart(3, "0")}`,
  moduleId: "verbal",
  topicId: "connective",
  knowledgeId: connectiveOverviewKnowledge[index].id,
  stem: item.stem,
  options: item.options.map((text, optionIndex) => ({
    id: letters[optionIndex],
    text
  })),
  answer: letters[item.answerIndex],
  explanation: `Word 材料要点：${item.detail}`
}));

const connectiveKnowledge = [
  ...connectiveOverviewKnowledge,
  ...connectiveTermKnowledge
];
const connectiveQuestions = [
  ...connectiveOverviewQuestions,
  ...buildConnectiveQuestions(connectiveTermKnowledge)
];

module.exports = {
  connectiveKnowledge,
  connectiveQuestions
};
