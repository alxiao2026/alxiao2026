// 抖音团购品类分类数据
export interface Category {
  id: string;
  name: string;
  children?: Category[];
}

export const DOUYIN_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: '餐饮美食',
    children: [
      { id: 'food-chinese', name: '中式正餐' },
      { id: 'food-hotpot', name: '火锅烧烤' },
      { id: 'food-western', name: '西餐咖啡' },
      { id: 'food-fast', name: '快餐简餐' },
      { id: 'food-dessert', name: '甜品饮品' },
      { id: 'food-breakfast', name: '早餐点心' },
      { id: 'food-japanese', name: '日韩料理' },
      { id: 'food-seafood', name: '海鲜水产' },
      { id: 'food-bbq', name: '烧烤烤肉' },
      { id: 'food-snack', name: '小吃面食' },
    ],
  },
  {
    id: 'beauty',
    name: '美容美发',
    children: [
      { id: 'beauty-skin', name: '面部护理' },
      { id: 'beauty-hair', name: '发型设计' },
      { id: 'beauty-nail', name: '美甲美睫' },
      { id: 'beauty-makeup', name: '化妆造型' },
      { id: 'beauty-spa', name: 'SPA 按摩' },
      { id: 'beauty-body', name: '身体护理' },
    ],
  },
  {
    id: 'entertainment',
    name: '休闲娱乐',
    children: [
      { id: 'entertainment-movie', name: '电影票' },
      { id: 'entertainment-ktv', name: 'KTV' },
      { id: 'entertainment-game', name: '桌游吧' },
      { id: 'entertainment-park', name: '游乐场' },
      { id: 'entertainment-gym', name: '健身房' },
      { id: 'entertainment-bath', name: '洗浴汗蒸' },
      { id: 'entertainment-foot', name: '足浴按摩' },
      { id: 'entertainment-climb', name: '攀岩运动' },
      { id: 'entertainment-hot-spring', name: '温泉' },
    ],
  },
  {
    id: 'travel',
    name: '旅行度假',
    children: [
      { id: 'travel-hotel', name: '酒店预订' },
      { id: 'travel-scenic', name: '景点门票' },
      { id: 'travel-package', name: '旅游套餐' },
      { id: 'travel-surrounding', name: '周边游' },
      { id: 'travel-domestic', name: '国内游' },
      { id: 'travel-outbound', name: '出境游' },
      { id: 'travel-cruise', name: '邮轮游' },
      { id: 'travel-self-drive', name: '自驾游' },
    ],
  },
  {
    id: 'shopping',
    name: '购物',
    children: [
      { id: 'shopping-clothes', name: '服饰鞋包' },
      { id: 'shopping-cosmetics', name: '美妆护肤' },
      { id: 'shopping-digital', name: '数码 3C' },
      { id: 'shopping-home', name: '家居生活' },
      { id: 'shopping-jewelry', name: '珠宝饰品' },
      { id: 'shopping-supermarket', name: '超市购物' },
      { id: 'shopping-fresh', name: '生鲜水果' },
    ],
  },
  {
    id: 'education',
    name: '教育培训',
    children: [
      { id: 'education-language', name: '语言培训' },
      { id: 'education-skill', name: '职业技能' },
      { id: 'education-art', name: '艺术培训' },
      { id: 'education-sports', name: '体育培训' },
      { id: 'education-kids', name: '少儿培训' },
      { id: 'education-online', name: '在线课程' },
      { id: 'education-driving', name: '驾校培训' },
    ],
  },
  {
    id: 'life-service',
    name: '生活服务',
    children: [
      { id: 'life-housekeeping', name: '家政服务' },
      { id: 'life-repair', name: '维修保养' },
      { id: 'life-move', name: '搬家服务' },
      { id: 'life-clean', name: '保洁清洗' },
      { id: 'life-photo', name: '摄影摄像' },
      { id: 'life-pet', name: '宠物服务' },
      { id: 'life-health', name: '健康体检' },
    ],
  },
  {
    id: 'parent-child',
    name: '亲子活动',
    children: [
      { id: 'parent-park', name: '亲子乐园' },
      { id: 'parent-early', name: '早教中心' },
      { id: 'parent-photo', name: '儿童摄影' },
      { id: 'parent-supplies', name: '儿童用品' },
      { id: 'parent-play', name: '儿童游乐' },
    ],
  },
  {
    id: 'wedding',
    name: '婚庆摄影',
    children: [
      { id: 'wedding-photo', name: '婚纱摄影' },
      { id: 'wedding-plan', name: '婚礼策划' },
      { id: 'wedding-supplies', name: '婚庆用品' },
      { id: 'wedding-ring', name: '婚戒首饰' },
    ],
  },
  {
    id: 'health',
    name: '健康养生',
    children: [
      { id: 'health-supplement', name: '营养补品' },
      { id: 'health-herb', name: '中草药' },
      { id: 'health-tea', name: '茶叶饮品' },
      { id: 'health-equipment', name: '健身器材' },
      { id: 'health-course', name: '健身课程' },
    ],
  },
];

// 获取所有一级分类
export const getLevel1Categories = (): Category[] => {
  return DOUYIN_CATEGORIES;
};

// 根据一级分类 ID 获取二级分类
export const getLevel2Categories = (level1Id: string): Category[] => {
  const category = DOUYIN_CATEGORIES.find((c) => c.id === level1Id);
  return category?.children || [];
};

// 根据分类 ID 获取分类名称
export const getCategoryName = (categoryId: string): string => {
  for (const category of DOUYIN_CATEGORIES) {
    if (category.id === categoryId) return category.name;
    if (category.children) {
      const child = category.children.find((c) => c.id === categoryId);
      if (child) return child.name;
    }
  }
  return '';
};

// 获取完整分类路径
export const getCategoryPath = (categoryId: string): string => {
  for (const category of DOUYIN_CATEGORIES) {
    if (category.id === categoryId) return category.name;
    if (category.children) {
      const child = category.children.find((c) => c.id === categoryId);
      if (child) return `${category.name} · ${child.name}`;
    }
  }
  return '';
};
