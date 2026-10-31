/** Select the authored solution paragraph for a legacy card, without inventing a pitch. */
export function proposalSummary(body: string): string {
  const solution = body.match(
    /^##\s+(?:soluci[oó]n propuesta|proposed solution|solution)\s*\r?\n([\s\S]*?)(?=^#{1,2}\s|$(?![\s\S]))/im,
  )?.[1];
  const paragraphs = (solution ?? body).split(/\r?\n\s*\r?\n/);
  return (
    paragraphs
      .find((paragraph) => {
        const text = paragraph.trim();
        return text.length > 0 && !/^(?:#{1,6}\s|\||>|[-*]\s|```)/.test(text);
      })
      ?.trim() ?? ""
  );
}
