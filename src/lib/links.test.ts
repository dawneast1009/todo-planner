import { describe, expect, it } from 'vitest';
import { extractLinks } from './links';

const hrefs = (s: string) => extractLinks(s).map((l) => l.href);

describe('extractLinks', () => {
  it('http·https·www 주소를 찾는다', () => {
    expect(hrefs('과제 제출 https://classroom.google.com/c/abc 여기서')).toEqual(['https://classroom.google.com/c/abc']);
    expect(hrefs('참고 www.naver.com')).toEqual(['https://www.naver.com']);
    expect(hrefs('http://example.com')).toEqual(['http://example.com']);
  });

  it('문장 끝 문장부호와 감싼 괄호는 빼고, 주소 안의 괄호는 지킨다', () => {
    expect(hrefs('여기 봐 https://a.com/b.')).toEqual(['https://a.com/b']);
    expect(hrefs('(https://a.com/b)')).toEqual(['https://a.com/b']);
    expect(hrefs('위키 https://ko.wikipedia.org/wiki/A_(B) 참고')).toEqual(['https://ko.wikipedia.org/wiki/A_(B)']);
  });

  it('여러 개, 같은 주소는 한 번만', () => {
    expect(hrefs('https://a.com\nhttps://b.com https://a.com')).toEqual(['https://a.com', 'https://b.com']);
  });

  it('주소가 아닌 것은 무시', () => {
    expect(hrefs('그냥 메모 12.5점')).toEqual([]);
    expect(hrefs('https:// 만 있음')).toEqual([]);
  });

  it('짧은 이름', () => {
    expect(extractLinks('https://www.youtube.com/watch?v=abcdefghijklmnopqrstuvwxyz')[0].label).toBe(
      'youtube.com/watch?v=abcdefghijklmno…',
    );
    expect(extractLinks('https://naver.com/')[0].label).toBe('naver.com');
  });
});
