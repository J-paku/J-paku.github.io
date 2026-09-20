// 村ページ専用のブートローダー。黒い舞台の中央にサイトロゴを出し、村の見出し(data-boot-target)の
// 位置と大きさへ飛ばして着地させてから覆いを外す。着地先と同じ Logo を描くので、ロゴが
// 「読み込み画面」ではなく「タイトルが定位置に収まる場面」として見える。装飾なので支援技術からは隠す。
// ロゴの文字はシステム書体なので書体ロードは待たない。どんな環境でも CAP で無条件に外す。
// <Link> によるクライアント遷移では挿入した script が実行されない(ブラウザは差分挿入された
// インライン script を走らせない)ため、同じ手順を effect 側にも用意して二重に対応する
'use client'
import { useEffect } from 'react'
import Logo from '@/components/ui/Logo'
import './boot.css'

type BootProps = { name: string }

// 見出しは DOM 上でこの要素より後にあるため、DOM 構築完了を待ってから位置を測る。
// 見出し側の非表示は CSS(.stage:has(#boot))が担い、script は React が描いた要素の属性を触らない。
// script 側・effect 側のどちらが先に走っても data-run を確認してから立てるので、
// 先に着地した側が勝ち、後から動く方は二重実行しない
const BOOT_SCRIPT = `;(function(){
var run=function(){
var boot=document.getElementById('boot');if(boot===null)return;
if(boot.hasAttribute('data-run'))return;
boot.setAttribute('data-run','');
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

// script と同じ手順を TypeScript 側でも行う(script は文字列なので関数を共有できず、
// 手順だけをここに複製する)。呼び出し側で data-run 済みかどうかを確認してから呼ぶ
const runBoot = (boot: HTMLElement) => {
  boot.setAttribute('data-run', '')
  const child = boot.firstElementChild
  const logo = child instanceof SVGElement ? child : null
  const target = document.querySelector('[data-boot-target]')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let done = false
  const timers: number[] = []
  const finish = () => {
    if (done) return
    done = true
    boot.remove()
  }
  timers.push(window.setTimeout(finish, 1500))
  if (reduce || target === null || logo === null) {
    timers.push(window.setTimeout(finish, 300))
    return timers
  }
  const from = logo.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  timers.push(
    window.setTimeout(() => {
      logo.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})`
      boot.setAttribute('data-moving', '')
    }, 450)
  )
  timers.push(window.setTimeout(finish, 1000))
  return timers
}

function Boot({ name }: BootProps) {
  // 初回読み込みは script が hydration 前に data-run を立てているのでここでは何もしない。
  // クライアント遷移では #boot が data-run を持たない新しい要素として現れるのでここが動く
  useEffect(() => {
    const boot = document.getElementById('boot')
    if (boot === null || boot.hasAttribute('data-run')) return undefined
    const timers = runBoot(boot)
    return () => {
      timers.forEach(id => window.clearTimeout(id))
    }
  }, [])

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
