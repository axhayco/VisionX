import React from 'react';
import { truncateAtWordBoundary } from '../utils/text';

/**
 * Reusable component for displaying text truncated at word boundaries with full text tooltip.
 *
 * @param {object} props
 * @param {string} props.text - The text to display and truncate.
 * @param {number} [props.maxLength=70] - Max character length before truncating at word boundary.
 * @param {string} [props.className='row-reasoning'] - CSS class to apply.
 * @param {boolean} [props.showTooltip=true] - Whether to attach the full text as title tooltip.
 */
export const TruncatedText = ({
  text,
  maxLength = 70,
  className = 'row-reasoning',
  showTooltip = true,
}) => {
  if (!text) {
    return <span className={className}>—</span>;
  }

  const truncated = truncateAtWordBoundary(text, maxLength);
  const isTruncated = text.length > truncated.length;

  return (
    <span
      className={className}
      title={showTooltip && isTruncated ? text : undefined}
    >
      {truncated}
    </span>
  );
};
