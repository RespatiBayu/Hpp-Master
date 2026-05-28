const decimalFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const quantityFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

export const formatCurrency = (value: number) => `Rp ${currencyFormatter.format(Math.round(Number(value) || 0))}`;

export const formatCurrencyDecimal = (value: number) => `Rp ${decimalFormatter.format(Number(value) || 0)}`;

export const formatDecimal = (value: number) => decimalFormatter.format(Number(value) || 0);

export const formatQty = (value: number) => {
  const numericValue = Number(value) || 0;
  return quantityFormatter.format(numericValue);
};
