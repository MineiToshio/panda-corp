/** RFC 9457 error response for HTTP boundaries. */
export function problem(
  status: number,
  title: string,
  options: { detail: string; instance: string },
): Response {
  return Response.json(
    { type: "about:blank", title, status, ...options },
    {
      status,
      headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" },
    },
  );
}
