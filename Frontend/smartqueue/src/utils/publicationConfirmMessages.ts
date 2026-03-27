const SAVE_REMINDER = 'Remember to save your changes to apply.';

export function publicationConfirmTitle(nextPublished: boolean): string {
  return nextPublished ? 'Publish this event?' : 'Unpublish this event?';
}

export function publicationConfirmBody(nextPublished: boolean): string {
  if (nextPublished) {
    return `This event will be marked as published. It can appear on the home page when that feed is connected. ${SAVE_REMINDER}`;
  }
  return `This event will return to draft (unpublished). ${SAVE_REMINDER}`;
}
