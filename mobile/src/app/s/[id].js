// A shared Spark link (https://…/s/<id>) opened in the phone app: show that Spark.
import { Redirect, useLocalSearchParams } from 'expo-router';
export default function SharedSpark() {
  const { id } = useLocalSearchParams();
  return <Redirect href={`/spark/${id}`} />;
}
