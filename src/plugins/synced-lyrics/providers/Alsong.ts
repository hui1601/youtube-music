import type { LyricProvider, LyricResult, SearchSongInfo, LineLyrics } from '../types';

const hangulRegex = /[ㄱ-ㅎ|가-힣]/;

export class Alsong implements LyricProvider {
  public name = 'Alsong';
  public baseUrl = 'https://hapi.us.to';
  // prettier-ignore
  async search({ title, artist, songDuration }: SearchSongInfo): Promise<LyricResult | null> {
    const query = new URLSearchParams({
      title,
      artist,
      duration: songDuration.toString(),
    });

    const response = await fetch(`${this.baseUrl}/api3/lyrics/search.json?${query}`);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as LyricsAlsongSearchResult;
    const closestHit = data[0];
    if (!closestHit) {
      return null;
    }
    const responseDetail = await fetch(`${this.baseUrl}/api3/lyrics/detail/${closestHit.id}.json`);
    if (!responseDetail.ok) {
      return null;
    }
    const dataDetail = (await responseDetail.json()) as LyricsAlsongDetailResponse;
    const lines = dataDetail.lyrics;
    const linesArray: LineLyrics[] = [];
    for (let i = 0; i < Object.keys(lines).length; i++) {
      const currentLine = Object.keys(lines)[i];
      const timeInMs = parseInt(currentLine, 10);
      const duration = Object.keys(lines)[i + 1]
        ? parseInt(Object.keys(lines)[i + 1], 10) - timeInMs
        : songDuration * 1000 - timeInMs;
      let koreanText = '';
      if (lines[currentLine].length == 3) {
        koreanText = lines[currentLine][2];
      } else if (lines[currentLine].length == 2 && hangulRegex.test(lines[currentLine][1])) {
        koreanText = lines[currentLine][1];
      }
      const text = lines[currentLine][0];
      const status = 'upcoming' as const;

      linesArray.push({
        time: this.millisToTime(timeInMs),
        timeInMs,
        duration,
        text,
        translation: hangulRegex.test(koreanText) ? koreanText.trim() : undefined,
        status,
      });
    }
    const result: LyricResult = {
      // I know this is not correct, but alsong api does not provide consistent data
      title: title,
      artists: [],
      lines: linesArray,
      lyrics: Object.entries(lines)
        .map(([millisecond, texts]) => {
          const timeInMs = parseInt(millisecond, 10);
          const text = texts.join(' ');
          return `${this.millisToTime(timeInMs)} ${text}`;
        })
        .join('\n'),
    };
    return result;
  }

  private millisToTime(millis: number): string {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis - minutes * 60 * 1000) / 1000);
    const remaining = (millis - minutes * 60 * 1000 - seconds * 1000) / 10;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${remaining.toString().padStart(2, '0')}`;
  }
}
type LyricsAlsongSearchResult = LyricsAlsongSearchResultItem[];

interface LyricsAlsongSearchResultItem {
  title: string;
  artist: string;
  album: string;
  duration: number;
  id: number;
  added_time: string;
}

interface LyricsAlsongDetailResponse {
  title: string;
  artist: string;
  album: string;
  lyrics: LyricsAlsongTimestampedLines;
}

interface LyricsAlsongTimestampedLines {
  [millisecond: string]: string[];
}