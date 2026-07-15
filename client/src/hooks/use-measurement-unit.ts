import { useQuery } from "@tanstack/react-query";

export type MeasurementUnit = "imperial" | "metric";

export function useMeasurementUnit(): MeasurementUnit {
  const { data } = useQuery<any>({
    queryKey: ["/api/company-settings"],
    staleTime: 5 * 60 * 1000,
  });
  return (data?.measurementUnit ?? "imperial") as MeasurementUnit;
}

export function formatLength(value: number, unit: MeasurementUnit): string {
  if (unit === "metric") return `${(value * 0.3048).toFixed(1)} m`;
  return `${value} ft`;
}

export function formatArea(value: number, unit: MeasurementUnit): string {
  if (unit === "metric") return `${(value * 0.0929).toFixed(1)} m²`;
  return `${value} sq ft`;
}
