// 村ページ専用のブートローダー。黒い舞台の中央にサイトロゴを出し、村の見出し(data-boot-target)の
// 位置と大きさへ飛ばして着地させてから覆いを外す。着地先と同じ Logo を描くので、ロゴが
// 「読み込み画面」ではなく「タイトルが定位置に収まる場面」として見える。装飾なので支援技術からは隠す。
// ロゴの文字はシステム書体なので書体ロードは待たない。どんな環境でも CAP で無条件に外す
import Logo from '@/components/ui/Logo'
import './boot.css'

type BootProps = { name: string }

// 見出しは DOM 上でこの要素より後にあるため、DOM 構築完了を待ってから位置を測る。
// 見出し側の非表示は CSS(.stage:has(#boot))が担い、script は React が描いた要素の属性を触らない
const BOOT_SCRIPT = `;(function(){
var run=function(){
var boot=document.getElementById('boot');if(boot===null)return;
var logo=boot.firstElementChild;var target=document.querySelector('[data-boot-target]');
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var done=false;
var finish=function(){if(done)return;done=true;boot.remove()};
window.setTimeout(finish,1500);
if(reduce||target===null||logo===null){window.setTimeout(finish,300);return}
var from=logo.getBoundingClientRect();var to=target.getBoundingClientRect();
window.setTimeout(function(){
logo.style.transform='translate('+(to.left-from.left)+'px,'+(to.top-from.top)+'px) scale('+(to.width/from.width)+')';
boot.setAttribute('data-moving','')},450);
window.setTimeout(finish,1000)};
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run)}else{run()}
})()`

function Boot({ name }: BootProps) {
  return (
    <>
      {/* script が hydration 前に data-moving を書くため、この要素の属性差分は警告対象から外す */}
      <div id='boot' aria-hidden='true' suppressHydrationWarning>
        <Logo name={name} />
      </div>
      <noscript>
        <style>{'#boot { display: none; }'}</style>
      </noscript>
      <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
    </>
  )
}

export default Boot
