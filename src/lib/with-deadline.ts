/** The underlying operation may still complete; callers must retain write IDs. */
export async function withDeadline<T>(
  request: PromiseLike<T>,
  milliseconds: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Request timed out')),
          milliseconds
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
