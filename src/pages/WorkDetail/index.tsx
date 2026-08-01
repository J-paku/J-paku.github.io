import { useParams } from 'react-router'

// 04段階で本文8節を実装する最小スタブ。見出しには slug をそのまま表示する
function WorkDetail() {
  const { slug } = useParams()

  return <h1>{slug}</h1>
}

export default WorkDetail
