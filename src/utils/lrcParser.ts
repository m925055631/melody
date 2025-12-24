/**
 * LRC歌词解析工具
 * 支持标准LRC格式: [mm:ss.xx]歌词文本
 */

export interface LyricLine {
    time: number;      // 时间戳（秒）
    text: string;      // 歌词文本
}

/**
 * 解析LRC格式歌词
 * @param lrcContent - LRC格式的歌词字符串
 * @returns 解析后的歌词数组，按时间排序
 */
export function parseLRC(lrcContent: string): LyricLine[] {
    if (!lrcContent) return [];

    const lines = lrcContent.split('\n');
    const lyrics: LyricLine[] = [];

    lines.forEach(line => {
        // 匹配 [mm:ss.xx] 或 [mm:ss.xxx] 格式
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const ms = parseInt(match[3].padEnd(3, '0'));
            const time = minutes * 60 + seconds + ms / 1000;
            const text = match[4].trim();

            // 只添加有文本内容的行
            if (text) {
                lyrics.push({ time, text });
            }
        }
    });

    // 按时间排序
    return lyrics.sort((a, b) => a.time - b.time);
}

/**
 * 根据当前播放时间获取应该高亮的歌词索引
 * @param lyrics - 歌词数组
 * @param currentTime - 当前播放时间（秒）
 * @returns 当前应该显示的歌词索引，如果没有则返回-1
 */
export function getCurrentLyricIndex(
    lyrics: LyricLine[],
    currentTime: number
): number {
    if (!lyrics || lyrics.length === 0) return -1;

    // 从后往前找，找到第一个时间小于等于当前时间的歌词
    for (let i = lyrics.length - 1; i >= 0; i--) {
        if (currentTime >= lyrics[i].time) {
            return i;
        }
    }

    return -1;
}

/**
 * 检查歌词是否为LRC格式
 * @param content - 歌词内容
 * @returns 是否为LRC格式
 */
export function isLRCFormat(content: string): boolean {
    if (!content) return false;
    // 检查是否包含时间标签 [mm:ss.xx]
    return /\[\d{2}:\d{2}\.\d{2,3}\]/.test(content);
}

/**
 * 将普通歌词转换为简单的LRC格式（用于兼容）
 * @param plainLyrics - 普通歌词文本
 * @returns LyricLine数组
 */
export function convertPlainToLyrics(plainLyrics: string): LyricLine[] {
    const lines = plainLyrics.split('\n').filter(line => line.trim());
    return lines.map((text, index) => ({
        time: index * 3, // 假设每行3秒
        text: text.trim()
    }));
}
