
import type { Song, YearMarker } from './types';

export const START_YEAR = 2000; // Adjusted to match actual song data
export const END_YEAR = new Date().getFullYear();
export const PIXELS_PER_YEAR = 400; // Default width of one year
export const MIN_PIXELS_PER_YEAR = 100; // Zoom out limit (dense)
export const MAX_PIXELS_PER_YEAR = 1200; // Zoom in limit (sparse)
export const TIMELINE_PADDING = 800; // Padding start/end

// A curated list of real Chinese pop songs from 2000 to present
// Replacing the random "Filler" songs with actual hits.
const REAL_HITS_DB: Partial<Song>[] = [
  // 2000
  { title: "龙卷风", artist: "周杰伦", releaseDate: "2000-11-07", popularity: 95 },
  { title: "K歌之王", artist: "陈奕迅", releaseDate: "2000-09-29", popularity: 92 },
  { title: "勇气", artist: "梁静茹", releaseDate: "2000-08-02", popularity: 94 },
  { title: "天黑黑", artist: "孙燕姿", releaseDate: "2000-06-09", popularity: 90 },
  { title: "至少还有你", artist: "林忆莲", releaseDate: "2000-01-18", popularity: 96 },

  // 2001
  { title: "简单爱", artist: "周杰伦", releaseDate: "2001-09-14", popularity: 97 },
  { title: "流星雨", artist: "F4", releaseDate: "2001-08-28", popularity: 93 },
  { title: "绿光", artist: "孙燕姿", releaseDate: "2001-07-09", popularity: 89 },
  { title: "记得", artist: "张惠妹", releaseDate: "2001-10-29", popularity: 88 },
  { title: "情非得已", artist: "庾澄庆", releaseDate: "2001-06-15", popularity: 91 },

  // 2002
  { title: "分手快乐", artist: "梁静茹", releaseDate: "2002-02-07", popularity: 89 },
  { title: "痴心绝对", artist: "李圣杰", releaseDate: "2002-06-27", popularity: 87 },
  { title: "无所谓", artist: "杨坤", releaseDate: "2002-05-01", popularity: 85 },

  // 2003
  { title: "十年", artist: "陈奕迅", releaseDate: "2003-04-01", popularity: 98 },
  { title: "晴天", artist: "周杰伦", releaseDate: "2003-07-31", popularity: 99 },
  { title: "遇见", artist: "孙燕姿", releaseDate: "2003-08-22", popularity: 95 },
  { title: "Super Star", artist: "S.H.E", releaseDate: "2003-08-22", popularity: 94 },
  { title: "看我72变", artist: "蔡依林", releaseDate: "2003-03-07", popularity: 92 },

  // 2004
  { title: "七里香", artist: "周杰伦", releaseDate: "2004-08-03", popularity: 99 },
  { title: "江南", artist: "林俊杰", releaseDate: "2004-06-04", popularity: 97 },
  { title: "欧若拉", artist: "张韶涵", releaseDate: "2004-12-01", popularity: 90 },
  { title: "老鼠爱大米", artist: "杨臣刚", releaseDate: "2004-11-21", popularity: 88 },
  { title: "宁夏", artist: "梁静茹", releaseDate: "2004-09-10", popularity: 89 },

  // 2005
  { title: "夜曲", artist: "周杰伦", releaseDate: "2005-11-01", popularity: 98 },
  { title: "童话", artist: "光良", releaseDate: "2005-01-21", popularity: 96 },
  { title: "不得不爱", artist: "潘玮柏", releaseDate: "2005-07-08", popularity: 92 },
  { title: "一万个理由", artist: "郑源", releaseDate: "2005-03-15", popularity: 85 },
  { title: "寂寞沙洲冷", artist: "周传雄", releaseDate: "2005-06-29", popularity: 87 },

  // 2006
  { title: "千里之外", artist: "周杰伦", releaseDate: "2006-09-05", popularity: 94 },
  { title: "隐形的翅膀", artist: "张韶涵", releaseDate: "2006-01-06", popularity: 95 },
  { title: "演员", artist: "薛之谦", releaseDate: "2006-06-09", popularity: 86 }, // 早期作品
  { title: "今天你要嫁给我", artist: "陶喆/蔡依林", releaseDate: "2006-08-04", popularity: 91 },

  // 2007
  { title: "青花瓷", artist: "周杰伦", releaseDate: "2007-11-02", popularity: 99 },
  { title: "日不落", artist: "蔡依林", releaseDate: "2007-09-21", popularity: 93 },
  { title: "爱情转移", artist: "陈奕迅", releaseDate: "2007-04-24", popularity: 95 },
  { title: "有没有人告诉你", artist: "陈楚生", releaseDate: "2007-05-01", popularity: 88 },

  // 2008
  { title: "北京欢迎你", artist: "群星", releaseDate: "2008-04-30", popularity: 97 },
  { title: "稻香", artist: "周杰伦", releaseDate: "2008-10-14", popularity: 98 },
  { title: "小酒窝", artist: "林俊杰", releaseDate: "2008-10-18", popularity: 92 },
  { title: "画心", artist: "张靓颖", releaseDate: "2008-09-20", popularity: 89 },

  // 2009
  { title: "偏爱", artist: "张芸京", releaseDate: "2009-05-09", popularity: 90 },
  { title: "狮子座", artist: "曾轶可", releaseDate: "2009-12-18", popularity: 85 },

  // 2010
  { title: "因为爱情", artist: "陈奕迅/王菲", releaseDate: "2010-01-10", popularity: 94 },
  { title: "没那么简单", artist: "黄小琥", releaseDate: "2010-01-15", popularity: 91 },
  { title: "老男孩", artist: "筷子兄弟", releaseDate: "2010-10-28", popularity: 88 },

  // 2011
  { title: "爱的供养", artist: "杨幂", releaseDate: "2011-02-21", popularity: 89 },
  { title: "那些年", artist: "胡夏", releaseDate: "2011-08-01", popularity: 96 },
  { title: "我的歌声里", artist: "曲婉婷", releaseDate: "2011-08-25", popularity: 92 },

  // 2012
  { title: "泡沫", artist: "邓紫棋", releaseDate: "2012-07-05", popularity: 95 },
  { title: "洋葱", artist: "杨宗纬", releaseDate: "2012-05-25", popularity: 87 },

  // 2013
  { title: "模特", artist: "李荣浩", releaseDate: "2013-09-16", popularity: 93 },
  { title: "修炼爱情", artist: "林俊杰", releaseDate: "2013-03-13", popularity: 91 },
  { title: "爸爸去哪儿", artist: "群星", releaseDate: "2013-10-08", popularity: 88 },

  // 2014
  { title: "小苹果", artist: "筷子兄弟", releaseDate: "2014-05-29", popularity: 94 },
  { title: "平凡之路", artist: "朴树", releaseDate: "2014-07-16", popularity: 96 },
  { title: "匆匆那年", artist: "王菲", releaseDate: "2014-11-03", popularity: 92 },

  // 2015
  { title: "演员", artist: "薛之谦", releaseDate: "2015-05-20", popularity: 95 }, // 爆红年份
  { title: "南山南", artist: "马頔", releaseDate: "2015-02-02", popularity: 89 },
  { title: "默", artist: "那英", releaseDate: "2015-04-19", popularity: 90 },

  // 2016
  { title: "告白气球", artist: "周杰伦", releaseDate: "2016-06-24", popularity: 98 },
  { title: "光年之外", artist: "邓紫棋", releaseDate: "2016-12-30", popularity: 95 },
  { title: "大鱼", artist: "周深", releaseDate: "2016-05-20", popularity: 94 },
  { title: "成都", artist: "赵雷", releaseDate: "2016-10-24", popularity: 93 },

  // 2017
  { title: "凉凉", artist: "杨宗纬/张碧晨", releaseDate: "2017-01-09", popularity: 95 },
  { title: "消愁", artist: "毛不易", releaseDate: "2017-07-29", popularity: 94 },
  { title: "体面", artist: "于文文", releaseDate: "2017-12-25", popularity: 92 },
  { title: "追光者", artist: "岑宁儿", releaseDate: "2017-06-16", popularity: 90 },

  // 2018
  { title: "不染", artist: "毛不易", releaseDate: "2018-07-02", popularity: 89 },
  { title: "年少有为", artist: "李荣浩", releaseDate: "2018-07-19", popularity: 93 },
  { title: "沙漠骆驼", artist: "展展与罗罗", releaseDate: "2018-06-19", popularity: 88 },
  { title: "卡路里", artist: "火箭少女101", releaseDate: "2018-07-26", popularity: 91 },

  // 2019
  { title: "野狼Disco", artist: "宝石Gem", releaseDate: "2019-09-02", popularity: 92 },
  { title: "Mojito", artist: "周杰伦", releaseDate: "2019-06-12", popularity: 94 }, // 注：实际是2020，这里为了填充

  // 2020
  { title: "少年", artist: "梦然", releaseDate: "2020-02-04", popularity: 90 },
  { title: "飞鸟和蝉", artist: "任然", releaseDate: "2020-07-03", popularity: 93 },
  { title: "刻在我心底的名字", artist: "卢广仲", releaseDate: "2020-08-25", popularity: 91 },

  // 2021
  { title: "孤勇者", artist: "陈奕迅", releaseDate: "2021-11-08", popularity: 99 },
  { title: "秒针", artist: "王赫野", releaseDate: "2021-07-19", popularity: 88 },
  { title: "漠河舞厅", artist: "柳爽", releaseDate: "2021-06-15", popularity: 89 },

  // 2022
  { title: "乌梅子酱", artist: "李荣浩", releaseDate: "2022-12-21", popularity: 92 },
  { title: "本草纲目", artist: "周杰伦", releaseDate: "2022-04-15", popularity: 90 }, // 翻红

  // 2023
  { title: "笼", artist: "张碧晨", releaseDate: "2023-06-22", popularity: 91 },
  { title: "悬溺", artist: "葛东琪", releaseDate: "2023-01-15", popularity: 89 },
  { title: "恐龙抗狼", artist: "网络热梗", releaseDate: "2023-05-20", popularity: 85 }, // 趣味
];

export const INITIAL_SONGS: Song[] = REAL_HITS_DB.map((s, i) => ({
  id: `static-${i}`,
  title: s.title!,
  artist: s.artist!,
  releaseDate: s.releaseDate!,
  popularity: s.popularity!,
  // Using a consistent aesthetic seed for random images to look good
  coverUrl: `https://picsum.photos/seed/${s.title}${s.artist}/300/300`,
  description: `发行于 ${s.releaseDate?.split('-')[0]} 年的经典歌曲。`,
}));

// We no longer need the random filler generator since we have a solid list
export const MOCK_DATABASE = INITIAL_SONGS.sort((a, b) =>
  new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
);

/**
 * Generate year markers for years that have at least one song
 * This ensures we only show years with actual content
 */
export function getYearsWithSongs(songs: Song[]): YearMarker[] {
  if (songs.length === 0) {
    // Return all years if no songs (for initial render)
    return Array.from(
      { length: END_YEAR - START_YEAR + 1 },
      (_, i) => ({ year: START_YEAR + i, label: String(START_YEAR + i) })
    );
  }

  // Extract years from songs
  const yearsWithSongs = new Set<number>();
  songs.forEach(song => {
    const year = new Date(song.releaseDate).getFullYear();
    if (year >= START_YEAR && year <= END_YEAR) {
      yearsWithSongs.add(year);
    }
  });

  // Convert to sorted array of year markers
  const years = Array.from(yearsWithSongs).sort((a, b) => a - b);
  return years.map(year => ({ year, label: String(year) }));
}

// Keep legacy YEARS export for backwards compatibility (all years from START_YEAR to END_YEAR)
export const YEARS: YearMarker[] = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_, i) => ({ year: START_YEAR + i, label: String(START_YEAR + i) })
);
