/**
 * Utility functions for formatting values in Zimplexline
 */

/**
 * Formats an amount into Sri Lankan Rupees (LKR)
 * Example: 45000 -> "LKR 45,000.00"
 */
export function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'LKR 0.00';
  }
  return `LKR ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a date string into a user-friendly format
 * Example: "2026-06-10T11:26:40Z" -> "Jun 10, 2026" or "10 Jun 2026, 11:26 AM"
 */
export function formatDate(dateString: string | null | undefined, includeTime = false): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    if (includeTime) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Formats a percentage
 * Example: 0.03 -> "3%"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  // If it's a small decimal (like 0.03 for 3%), multiply by 100
  const pct = value <= 1 && value > 0 ? value * 100 : value;
  return `${pct.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}
