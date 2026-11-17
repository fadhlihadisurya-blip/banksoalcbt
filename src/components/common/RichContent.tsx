import React, { useMemo } from 'react';
import { isRichHtml, sanitizeRichHtml } from '../../lib/richContent';

interface RichContentProps {
  html?: string | null;
  inline?: boolean;
  dark?: boolean;
  className?: string;
}

export const RichContent: React.FC<RichContentProps> = ({
  html,
  inline = false,
  dark = false,
  className = '',
}) => {
  const content = html || '';
  const rich = useMemo(() => isRichHtml(content), [content]);
  const safeHtml = useMemo(() => (rich ? sanitizeRichHtml(content) : ''), [rich, content]);

  const classes = [
    'rich-content',
    inline ? 'rich-content-inline' : '',
    dark ? 'rich-content-dark' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (!rich) {
    return (
      <span className={`${classes} whitespace-pre-wrap`}>
        {content}
      </span>
    );
  }

  return (
    <div
      className={classes}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
};
