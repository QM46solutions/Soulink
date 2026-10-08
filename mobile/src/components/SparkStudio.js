// Spark Studio on the phone-app build: editing runs in the Soulink web app for now, so this just moves on.
import { useEffect } from 'react';
export default function SparkStudio({ onNext }) {
  useEffect(() => { onNext({ duration: 0 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
