/**
 * Converts numbers to Bulgarian words.
 * Handles integers up to 999,999,999, decimals, currency (EUR), and percentages.
 * Respects Bulgarian grammatical gender for numbers.
 */

type Gender = 'masculine' | 'feminine' | 'neuter';

const ONES_MASCULINE = ['', 'един', 'два', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'];
const ONES_FEMININE  = ['', 'една', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'];
const ONES_NEUTER    = ['', 'едно', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'];

const TEENS = [
  'десет', 'единадесет', 'дванадесет', 'тринадесет', 'четиринадесет',
  'петнадесет', 'шестнадесет', 'седемнадесет', 'осемнадесет', 'деветнадесет',
];

const TENS = [
  '', '', 'двадесет', 'тридесет', 'четиридесет',
  'петдесет', 'шестдесет', 'седемдесет', 'осемдесет', 'деветдесет',
];

const HUNDREDS = [
  '', 'сто', 'двеста', 'триста', 'четиристотин',
  'петстотин', 'шестстотин', 'седемстотин', 'осемстотин', 'деветстотин',
];

function getOnesArray(gender: Gender): string[] {
  switch (gender) {
    case 'feminine':  return ONES_FEMININE;
    case 'neuter':    return ONES_NEUTER;
    default:          return ONES_MASCULINE;
  }
}

/**
 * Converts an integer in range [0..999] to Bulgarian words.
 */
function groupToWords(n: number, gender: Gender): string {
  if (n === 0) return '';

  const h = Math.floor(n / 100);
  const remainder = n % 100;
  const t = Math.floor(remainder / 10);
  const o = remainder % 10;

  const ones = getOnesArray(gender);
  const parts: string[] = [];

  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }

  if (remainder === 0) {
    // nothing more
  } else if (remainder < 10) {
    parts.push(ones[remainder]);
  } else if (remainder < 20) {
    parts.push(TEENS[remainder - 10]);
  } else {
    if (o > 0) {
      parts.push(TENS[t]);
      parts.push(ones[o]);
    } else {
      parts.push(TENS[t]);
    }
  }

  // Join with "и" between the last two non-empty parts
  if (parts.length <= 1) return parts.join('');

  // In Bulgarian, "и" goes between the last two components:
  // "сто двадесет и пет", "сто и пет", "двадесет и пет"
  if (parts.length === 2) {
    return parts.join(' и ');
  }

  // 3 parts: hundreds + tens + ones → "сто двадесет и пет"
  return parts.slice(0, -1).join(' ') + ' и ' + parts[parts.length - 1];
}

/**
 * Converts a non-negative integer to Bulgarian words.
 * Supports values up to 999,999,999.
 * @param n - non-negative integer
 * @param gender - grammatical gender (default: 'masculine')
 */
export function numberToWords(n: number, gender: Gender = 'masculine'): string {
  if (n < 0) return 'минус ' + numberToWords(-n, gender);
  if (n === 0) return 'нула';

  n = Math.floor(n);

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const segments: string[] = [];

  // Millions (masculine: "един милион", "два милиона", "пет милиона")
  if (millions > 0) {
    if (millions === 1) {
      segments.push('един милион');
    } else {
      const millionWords = groupToWords(millions, 'masculine');
      segments.push(millionWords + (millions >= 2 && millions <= 9 ? ' милиона' : ' милиона'));
    }
  }

  // Thousands (feminine: "една хиляда", "две хиляди", "пет хиляди")
  if (thousands > 0) {
    if (thousands === 1) {
      segments.push('хиляда');
    } else {
      const thousandWords = groupToWords(thousands, 'feminine');
      segments.push(thousandWords + ' хиляди');
    }
  }

  // Remainder [0..999]
  if (remainder > 0) {
    // The remainder uses the requested gender only if it's the final group
    const remainderGender = (millions > 0 || thousands > 0) ? gender : gender;
    segments.push(groupToWords(remainder, remainderGender));
  }

  // Join segments with appropriate connectors
  if (segments.length === 1) return segments[0];

  // If last segment is < 100 (no hundreds), use "и" before it
  if (remainder > 0 && remainder < 100 && segments.length > 1) {
    return segments.slice(0, -1).join(' ') + ' и ' + segments[segments.length - 1];
  }

  return segments.join(' ');
}

/**
 * Converts a monetary amount in EUR to Bulgarian words.
 * E.g., 12000 → "дванадесет хиляди евро"
 * E.g., 12500.50 → "дванадесет хиляди и петстотин евро и петдесет цента"
 */
export function amountToWordsEUR(amount: number): string {
  if (amount < 0) return 'минус ' + amountToWordsEUR(-amount);

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  let result = numberToWords(intPart, 'neuter') + ' евро';

  if (decPart > 0) {
    result += ' и ' + numberToWords(decPart, 'masculine') + ' цента';
  }

  return result;
}

/**
 * Converts a percentage rate to Bulgarian words.
 * E.g., 12.8 → "дванадесет цяло и осем десети процента"
 * E.g., 5 → "пет процента"
 * E.g., 1 → "един процент"
 */
export function percentageToWords(rate: number): string {
  const intPart = Math.floor(rate);
  // Handle decimal part with proper precision
  const decStr = rate.toFixed(2);
  const decPart = parseInt(decStr.split('.')[1], 10);

  if (decPart === 0) {
    // Whole number percentage
    const words = numberToWords(intPart, 'masculine');
    return words + (intPart === 1 ? ' процент' : ' процента');
  }

  // Fractional percentage: "X цяло и Y стотни процента"
  const intWords = numberToWords(intPart, 'neuter');
  const decWords = numberToWords(decPart, 'feminine');

  // Determine fractional denomination
  let fraction: string;
  if (decPart % 10 === 0) {
    // e.g., 0.80 → "осем десети"
    const tenths = decPart / 10;
    const tenthWords = numberToWords(tenths, 'feminine');
    fraction = tenthWords + (tenths === 1 ? ' десета' : ' десети');
  } else {
    fraction = decWords + (decPart === 1 ? ' стотна' : ' стотни');
  }

  return intWords + ' цяло и ' + fraction + ' процента';
}

export default {
  numberToWords,
  amountToWordsEUR,
  percentageToWords,
};
