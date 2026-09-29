export function shouldCloseAfterTaskCreation(pendingFileCount: number, uploadFailed: boolean): boolean {
  return pendingFileCount === 0 || !uploadFailed;
}
