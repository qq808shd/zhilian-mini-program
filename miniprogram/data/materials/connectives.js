const connectiveKnowledge = [
  {
    id: "k-connective-causal",
    moduleId: "verbal",
    topicId: "connective",
    title: "因果关系",
    summary: "先回忆：表示原因、结果或结论的关联词都有哪些？",
    detail: "关系特点：前后构成原因与结果，结果部分通常承接前文并推进结论。\n\n常用搭配：因为…所以…；由于…因此…；之所以…是因为…。\n\n结果与结论词：所以、因此、因而、故而、于是、可见、看来、综上所述。\n\n结果动词：使得、致使、导致、造成，其中“致使、导致、造成”常引出负面结果。\n\n易错点：“之所以…是因为…”是先说结果，再补原因；“因此、故而、可见”既能提示结果，也常承担总结作用。",
    memory: "常规是先因后果；看到“之所以”，记住果在前、因在后。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["逻辑关系", "因果", "结果"]
  },
  {
    id: "k-connective-adversative",
    moduleId: "verbal",
    topicId: "connective",
    title: "转折关系",
    summary: "先回忆：表示语义转向的“但是、但、却”还有哪些？",
    detail: "关系特点：前后语义方向发生转变，转折词后的内容通常更重要。\n\n成套搭配：虽然…但是…；尽管…可是…。\n\n常用词：但是、但、可是、然而、却、不过、则、殊不知。\n\n补充标志：其实、事实上、实际上有时既表示转折，也用于纠正或解释前文。\n\n易错点：“不过”语气较缓，“却、然而”转向更明显；做中心理解题时要重点看转折之后。",
    memory: "一见“但、却、然而”，先把注意力移到后半句。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["逻辑关系", "转折", "重点位置"]
  },
  {
    id: "k-connective-progressive",
    moduleId: "verbal",
    topicId: "connective",
    title: "递进关系",
    summary: "先回忆：哪些关联词会让语义从轻到重、继续推进？",
    detail: "关系特点：前后含义相近，但程度通常前轻后重，后半句更突出。\n\n成套搭配：不但…而且…；不仅…也…；除了…还…。\n\n常用词：更、尤其、特别是、真正、甚至、最。\n\n判断方法：如果后项在范围、程度或重要性上比前项更进一步，通常就是递进。\n\n易错点：“而且”单独出现时也可能只是并列补充；放在“不但…而且…”中时，递进关系最明确。",
    memory: "递进像上台阶：前轻后重，重点落在更进一步的后项。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["逻辑关系", "递进", "前轻后重"]
  },
  {
    id: "k-connective-parallel",
    moduleId: "verbal",
    topicId: "connective",
    title: "并列关系",
    summary: "先回忆：连接同一层级内容的词语和标点有哪些？",
    detail: "关系特点：前后内容处在同一层级，可以是含义相近、角度互补或项目罗列。\n\n常用词：和、及、与、同、也、以及、而且、此外、另外、同时、与此同时。\n\n常用结构：一方面…另一方面…。\n\n标点提示：顿号（、）和分号（；）经常连接并列项目。\n\n易错点：并列各项地位相近，没有明显的因果、转折或程度升级；“与此同时”还可能用于引入另一个话题。",
    memory: "并列看同层级：没有转向，也没有谁比谁更进一步。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["逻辑关系", "并列", "同层级"]
  },
  {
    id: "k-connective-contrast",
    moduleId: "verbal",
    topicId: "connective",
    title: "反义并列",
    summary: "先回忆：用来对照两个相反方面的结构有哪些？",
    detail: "关系特点：前后内容相反或形成鲜明对照，但两部分仍围绕同一问题并列展开。\n\n常用结构：是…不是…；不是…而是…。\n\n常用词：相反、反之。\n\n重点位置：“不是…而是…”通常否定前项、肯定后项，表达重点在“而是”之后。\n\n易错点：反义并列强调两项对照；一般转折则强调语义方向改变，两者观察角度不同。",
    memory: "看到“不是…而是…”，先删掉被否定的前项，记住后项。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["逻辑关系", "反义并列", "对照"]
  },
  {
    id: "k-connective-condition",
    moduleId: "verbal",
    topicId: "connective",
    title: "必要条件",
    summary: "先回忆：“只有…才…”中的“才”说明了什么？",
    detail: "关系特点：前项是后项实现时不可缺少的条件，没有前项，后项通常不能成立。\n\n典型搭配：只有…才…；除非…才…。\n\n材料标志：“才”“才能”常提示必要条件，例如“通过/采取某种措施，才能解决问题”。\n\n对比记忆：“只要…就…”强调条件足够，是充分条件；“只有…才…”强调条件不可缺少，是必要条件。\n\n易错点：不要只看到“才”就机械判断，还要确认前句确实是后句成立所必需的条件。",
    memory: "只有它还不一定成功，但没有它通常不行——这就是必要条件。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["逻辑关系", "条件", "只有才"]
  },
  {
    id: "k-connective-summary",
    moduleId: "verbal",
    topicId: "connective",
    title: "总结与结论",
    summary: "先回忆：哪些词会把前文收束成一个结论？",
    detail: "作用特点：承接前文的信息、原因或分项内容，给出归纳、结果或判断。\n\n常用词：因此、故而、可见、看来、综上所述。\n\n汇总提示：均、都、等也常把前面列举的内容收束起来。\n\n阅读重点：总结词之后往往是作者希望读者记住的结论。\n\n交叉用法：“因此、故而”既属于因果结果词，也可以在文段中承担总结作用；判断时要结合上下文。",
    memory: "看到“因此、可见、综上”，准备接收前文的压缩结论。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["文段标志", "总结", "结论"]
  },
  {
    id: "k-connective-strategy",
    moduleId: "verbal",
    topicId: "connective",
    title: "对策标志",
    summary: "先回忆：哪些词提示作者开始提出做法或解决方案？",
    detail: "作用特点：提示文段从分析问题转向提出做法、措施或建议。\n\n高频词：应该、应当、应、要、必须、需要、需、亟须、亟需、亟待＋具体做法。\n\n手段结构：通过、采取、依托于某种手段/途径/措施/方式/方法/渠道，才能达到目标。\n\n倡议词：呼吁、倡导、提倡、提醒、建议＋具体做法。\n\n辅助词：前提、基础、保障、关键、义务有时也会引出对策。\n\n易错点：“该”通常是指代词，不能因为含有“应当”的读音联想就把它判断成对策。",
    memory: "找“谁要做什么”：有明确行动主体和做法，才是真正的对策。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["文段标志", "对策", "做法"]
  },
  {
    id: "k-connective-reference",
    moduleId: "verbal",
    topicId: "connective",
    title: "指代词",
    summary: "先回忆：“这、该、此、其”通常指向哪里？",
    detail: "作用特点：代替前文已经出现的人、事、观点或整段内容，使表达更紧凑。\n\n常用词：这、该、此、其。\n\n宏观指代：“这、此”有时不只指一个名词，而是概括前面整句话或一整段内容。\n\n判断方法：把指代词替换为它前面的具体内容，检查句意是否通顺。\n\n易错点：“该”在这里通常表示“这个/上述”，是指代词，本身并不表示应该采取对策。",
    memory: "指代词要向前找：先看最近名词，再看前句或前段整体。",
    source: "关联词-完整版.pptx 备注",
    tags: ["文段标志", "指代", "回指"]
  },
  {
    id: "k-connective-explanation",
    moduleId: "verbal",
    topicId: "connective",
    title: "解释与话题引入",
    summary: "先回忆：哪些词或标点会补充说明、纠正认识或引出新话题？",
    detail: "作用特点：对前文作说明、补充或纠正，也可以引出接下来要展开的话题。\n\n解释词：其实、事实上、实际上常用于纠正原有认识，也可能兼有转折作用。\n\n原因说明：“由于”可以引出原因，常与“因此”等结果词共同构成因果关系。\n\n标点提示：冒号（：）常引出解释说明或具体内容。\n\n话题引入：“与此同时”既能连接并列内容，也可能带出另一个相关话题。\n\n易错点：同一个词可能承担多种作用，最终要看它连接的前后内容。",
    memory: "冒号看后文解释；“其实、事实上、实际上”留意纠正和补充。",
    source: "关联词.docx；关联词-完整版.pptx 备注",
    tags: ["文段标志", "解释", "话题引入"]
  }
];

const questionGroups = [
  {
    slug: "causal",
    knowledgeId: "k-connective-causal",
    items: [
      {
        stem: "下列哪组词主要表示因果关系中的结果或结论？",
        options: ["因此、所以、因而、故而", "但是、但、却、不过", "此外、同时、以及、另外", "应该、必须、亟待、建议"],
        answerIndex: 0,
        explanation: "“因此、所以、因而、故而”都可以承接原因并引出结果或结论。"
      },
      {
        stem: "“之所以能按时完成，是因为提前做了规划”采用的顺序是：",
        options: ["先原因，后结果", "先结果，后原因", "先转折，后并列", "先对策，后条件"],
        answerIndex: 1,
        explanation: "“之所以…是因为…”属于因果倒置：先说结果，再补充原因。"
      },
      {
        stem: "“连续暴雨______多处道路临时封闭。”填入哪一项最恰当？",
        options: ["此外", "然而", "导致", "尤其"],
        answerIndex: 2,
        explanation: "“导致”引出由暴雨产生的结果，而且该结果偏负面。"
      }
    ]
  },
  {
    slug: "adversative",
    knowledgeId: "k-connective-adversative",
    items: [
      {
        stem: "下列哪组词主要表示转折关系？",
        options: ["因此、故而、可见", "但是、但、却、然而", "此外、另外、同时", "需要、必须、亟待"],
        answerIndex: 1,
        explanation: "“但是、但、却、然而”都会让语义发生转向。"
      },
      {
        stem: "阅读“这个方案实施难度较大，但是长期收益明显”时，重点通常落在：",
        options: ["实施难度较大", "这个方案", "但是这个词本身", "长期收益明显"],
        answerIndex: 3,
        explanation: "一般转折关系中，转折词后的内容更能体现表达重点。"
      },
      {
        stem: "“前期准备并不充分，______团队仍按时完成了任务。”填入哪一项最恰当？",
        options: ["却", "因此", "此外", "甚至"],
        answerIndex: 0,
        explanation: "准备不足与按时完成语义相反，用“却”形成转折。"
      }
    ]
  },
  {
    slug: "progressive",
    knowledgeId: "k-connective-progressive",
    items: [
      {
        stem: "下列哪组主要是递进关系标志？",
        options: ["相反、反之、不是…而是", "因为…所以、由于…因此", "不但…而且、更、甚至", "和、及、与、同时"],
        answerIndex: 2,
        explanation: "“不但…而且”“更”“甚至”都会把语义继续向更高程度推进。"
      },
      {
        stem: "递进关系中，前后内容在程度上的典型顺序是：",
        options: ["前重后轻", "前轻后重", "完全相反", "没有任何联系"],
        answerIndex: 1,
        explanation: "递进的核心是含义相近、程度前轻后重，后项通常更突出。"
      },
      {
        stem: "“这项改革______提高了效率，______改善了服务体验。”最恰当的搭配是：",
        options: ["不但；而且", "虽然；但是", "因为；所以", "不是；而是"],
        answerIndex: 0,
        explanation: "两项成效在同一方向上继续推进，用“不但…而且…”表示递进。"
      }
    ]
  },
  {
    slug: "parallel",
    knowledgeId: "k-connective-parallel",
    items: [
      {
        stem: "下列哪组主要是并列关系标志？",
        options: ["和、及、与、此外、同时", "但是、然而、却、不过", "因此、所以、故而、可见", "只有、才、才能、除非"],
        answerIndex: 0,
        explanation: "“和、及、与、此外、同时”都常用于连接同一层级的内容。"
      },
      {
        stem: "“一方面要完善制度，另一方面要加强执行”体现的是：",
        options: ["因果关系", "转折关系", "并列关系", "必要条件"],
        answerIndex: 2,
        explanation: "“一方面…另一方面…”从两个同层级角度展开，属于并列。"
      },
      {
        stem: "下列哪组标点经常提示项目之间存在并列关系？",
        options: ["问号和叹号", "顿号和分号", "引号和书名号", "括号和省略号"],
        answerIndex: 1,
        explanation: "顿号（、）和分号（；）经常用于分隔并列项目。"
      }
    ]
  },
  {
    slug: "contrast",
    knowledgeId: "k-connective-contrast",
    items: [
      {
        stem: "下列哪组主要表示反义并列？",
        options: ["此外、同时、以及", "不是…而是、相反、反之", "因此、可见、故而", "尤其、甚至、更"],
        answerIndex: 1,
        explanation: "这些词语或结构用来呈现相反、对照的两个方面。"
      },
      {
        stem: "在“问题不是投入不足，而是方法不当”中，表达重点是：",
        options: ["投入不足", "问题本身", "方法不当", "不是这个词"],
        answerIndex: 2,
        explanation: "“不是…而是…”否定前项、肯定后项，重点在“而是”之后。"
      },
      {
        stem: "反义并列与一般转折相比，更强调：",
        options: ["两个相反方面的对照", "原因与结果的推导", "程度由轻到重", "提出具体解决办法"],
        answerIndex: 0,
        explanation: "反义并列把两个相反方面放在同一问题下对照呈现。"
      }
    ]
  },
  {
    slug: "condition",
    knowledgeId: "k-connective-condition",
    items: [
      {
        stem: "表示必要条件的典型搭配是：",
        options: ["虽然…但是…", "只要…就…", "只有…才…", "不但…而且…"],
        answerIndex: 2,
        explanation: "“只有…才…”强调前项是后项不可缺少的条件。"
      },
      {
        stem: "“只有持续练习，才会形成稳定记忆”中的“才”主要提示：",
        options: ["必要条件", "转折关系", "并列关系", "结果总结"],
        answerIndex: 0,
        explanation: "持续练习被表达为形成稳定记忆所不可缺少的条件。"
      },
      {
        stem: "下列对“只要…就…”和“只有…才…”的区别，正确的是：",
        options: ["二者都只表示转折", "前者偏充分条件，后者偏必要条件", "前者偏必要条件，后者偏充分条件", "二者都只表示并列"],
        answerIndex: 1,
        explanation: "“只要…就…”强调条件足够，“只有…才…”强调条件不可缺少。"
      }
    ]
  },
  {
    slug: "summary",
    knowledgeId: "k-connective-summary",
    items: [
      {
        stem: "下列哪组词常用来引出总结或结论？",
        options: ["但是、然而、却", "此外、另外、同时", "因此、可见、综上所述", "应该、必须、需要"],
        answerIndex: 2,
        explanation: "“因此、可见、综上所述”都可以收束前文并给出结论。"
      },
      {
        stem: "阅读文段时遇到“可见”，接下来通常要重点关注：",
        options: ["作者给出的结论", "与前文无关的新话题", "被否定的内容", "单纯的时间顺序"],
        answerIndex: 0,
        explanation: "“可见”常承接前文论据或原因，导出作者的判断。"
      },
      {
        stem: "材料中“均、都、等”常承担的作用是：",
        options: ["表示强转折", "汇总或概括前面列举的内容", "只提示必要条件", "只引出负面结果"],
        answerIndex: 1,
        explanation: "这些词可以把前面分散、列举的内容归并为整体。"
      }
    ]
  },
  {
    slug: "strategy",
    knowledgeId: "k-connective-strategy",
    items: [
      {
        stem: "下列哪组词最可能提示文段正在提出对策？",
        options: ["应该、必须、需要、亟待", "因此、可见、综上所述", "但是、然而、殊不知", "和、及、与、同时"],
        answerIndex: 0,
        explanation: "这些词后面经常跟随具体做法、措施或建议。"
      },
      {
        stem: "“亟须、亟需、亟待”在对策表达中还特别强调：",
        options: ["并列性", "紧迫性", "转折性", "指代性"],
        answerIndex: 1,
        explanation: "“亟”表示急迫，这些词会加强解决问题的紧迫感。"
      },
      {
        stem: "下列哪项最符合材料中的“手段＋目标”对策结构？",
        options: ["虽然困难，但是继续", "因为重视，所以成功", "通过完善流程，才能提升效率", "此外还有另一个问题"],
        answerIndex: 2,
        explanation: "“通过/采取/依托某种手段，才能达到目标”是典型对策表达。"
      }
    ]
  },
  {
    slug: "reference",
    knowledgeId: "k-connective-reference",
    items: [
      {
        stem: "下列哪组主要由指代词构成？",
        options: ["这、该、此、其", "因此、故而、可见", "但是、却、不过", "更、尤其、甚至"],
        answerIndex: 0,
        explanation: "“这、该、此、其”通常回指前文出现的人、事或观点。"
      },
      {
        stem: "判断“这、此”指代什么时，最合适的做法是：",
        options: ["只看后一句", "向前寻找具体名词、前句或前段内容", "一律理解为作者本人", "一律判断为对策"],
        answerIndex: 1,
        explanation: "指代内容通常位于前文，需要从近到远代入检查。"
      },
      {
        stem: "关于“该”的作用，下列说法正确的是：",
        options: ["一定表示转折", "一定表示因果", "通常表示‘这个/上述’，本身不等于对策词", "只能引出总结"],
        answerIndex: 2,
        explanation: "“该”多为指代词，需回指前文，不能机械判断为对策。"
      }
    ]
  },
  {
    slug: "explanation",
    knowledgeId: "k-connective-explanation",
    items: [
      {
        stem: "“其实、事实上、实际上”在文段中常见的作用是：",
        options: ["纠正或解释前文，并可能形成转折", "只表示并列", "只表示必要条件", "只表示时间先后"],
        answerIndex: 0,
        explanation: "这些词常用于纠正原有认识或补充事实，也可能兼具转折作用。"
      },
      {
        stem: "冒号（：）在材料中常提示：",
        options: ["前后完全无关", "解释说明或话题引入", "必要条件", "反义并列"],
        answerIndex: 1,
        explanation: "冒号后面经常展开说明、列举具体内容或引出话题。"
      },
      {
        stem: "关于“由于”的判断，下列说法更准确的是：",
        options: ["只能表示并列", "只能表示转折", "可以引出原因，并与结果词共同构成因果关系", "一定表示对策"],
        answerIndex: 2,
        explanation: "“由于”用于说明原因，常与“因此”等词配合形成因果关系。"
      }
    ]
  }
];

const letters = ["A", "B", "C", "D"];
const connectiveQuestions = [];

questionGroups.forEach((group) => {
  group.items.forEach((item, index) => {
    connectiveQuestions.push({
      id: `q-connective-${group.slug}-${String(index + 1).padStart(2, "0")}`,
      moduleId: "verbal",
      topicId: "connective",
      knowledgeId: group.knowledgeId,
      stem: item.stem,
      options: item.options.map((text, optionIndex) => ({
        id: letters[optionIndex],
        text
      })),
      answer: letters[item.answerIndex],
      explanation: item.explanation
    });
  });
});

module.exports = {
  connectiveKnowledge,
  connectiveQuestions
};
