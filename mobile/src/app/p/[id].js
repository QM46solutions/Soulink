// A shared post link (https://…/p/<id>) opened in the phone app: show that post.
import { Redirect, useLocalSearchParams } from 'expo-router';
export default function SharedPost() {
  const { id } = useLocalSearchParams();
  return <Redirect href={`/post/${id}`} />;
}
