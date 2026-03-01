import { amountToWordsEUR, percentageToWords } from './number-to-bulgarian-words.util';

export interface LoanCalculation {
  principal: number;
  annualRate: number;
  daysBetween: number;
  interestAmount: number;
  totalReturn: number;
  principalWords: string;
  interestAmountWords: string;
  totalReturnWords: string;
  interestRateWords: string;
}

/**
 * Calculates simple interest for a loan and returns both numeric values
 * and Bulgarian word representations.
 *
 * Formula: Interest = Principal × (rate / 100) × (days / 365)
 */
export function calculateLoan(
  amount: number,
  annualRate: number,
  contractDateStr: string,
  returnDateStr: string,
): LoanCalculation {
  const startDate = new Date(contractDateStr);
  const endDate = new Date(returnDateStr);

  const diffMs = endDate.getTime() - startDate.getTime();
  const daysBetween = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const interestAmount = amount * (annualRate / 100) * (daysBetween / 365);
  const roundedInterest = Math.round(interestAmount * 100) / 100;
  const totalReturn = Math.round((amount + roundedInterest) * 100) / 100;

  return {
    principal: amount,
    annualRate,
    daysBetween,
    interestAmount: roundedInterest,
    totalReturn,
    principalWords: amountToWordsEUR(amount),
    interestAmountWords: amountToWordsEUR(Math.abs(roundedInterest)),
    totalReturnWords: amountToWordsEUR(totalReturn),
    interestRateWords: percentageToWords(annualRate),
  };
}
