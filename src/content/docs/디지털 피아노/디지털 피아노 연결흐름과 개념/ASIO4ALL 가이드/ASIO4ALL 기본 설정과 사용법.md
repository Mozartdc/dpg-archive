---
title: "ASIO4ALL 기본 설정과 사용법"
date: 2026-08-11
lastEdited: 2026-08-11
notionPageId: "3b926dfb-cd79-81af-8cfa-d10855b67dce"
tags:
  - "ASIO4ALL 2.22 기준의 설치·설정·문제 해결 가이드임."
sidebar:
  order: 1
---



<img src="/images/ASIO4ALL-기본-설정과-사용법-0.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

ASIO4ALL은 Windows의 WDM 오디오 장치를 ASIO 프로그램에서 쓸 수 있게 연결해 주는 범용 드라이버임. 전용 ASIO 드라이버가 없는 내장 사운드 장치나 USB 오디오 장치를 DAW·가상악기에서 낮은 지연으로 사용할 때 주로 씀.

이 글은 <strong>ASIO4ALL 2.22</strong> 기준임. 2.22는 Windows 10과 Windows 11을 정식 지원하며, ARM64용 네이티브·EC 버전도 제공함. Windows 7·8에서도 작동한다고 확인됐지만 정식 지원 대상은 아님.


## ASIO4ALL이 필요한 경우

- 외장 오디오 인터페이스가 없고 내장 사운드 장치를 써야 할 때

- 사용 중인 오디오 장치에 전용 ASIO 드라이버가 없을 때

- 가상악기를 연주했을 때 소리가 늦게 따라올 때

- DAW에서 Windows 기본 오디오 드라이버보다 짧은 버퍼를 쓰고 싶을 때

MIDI 건반의 입력 자체가 느린 문제를 ASIO4ALL이 고치는 것은 아님. 건반을 누른 뒤 가상악기 소리가 나올 때까지의 오디오 출력 지연을 줄여서 반응이 빨라진 것처럼 느껴지는 경우가 많음.


## 다운로드와 설치

<a href="https://asio4all.org/about/download-asio4all/" target="_blank" style="color: inherit; text-decoration: underline;">ASIO4ALL 공식 다운로드</a>에서 2.22 다국어 설치 파일을 받음. 기존 버전에서 업데이트했다면 설치 후 컨트롤 패널의 기본값 불러오기 버튼을 한 번 눌러 2.22 권장값으로 되돌리는 편이 안전함.


## DAW에서 드라이버 선택

오디오 설정에서 드라이버 유형을 ASIO로 바꾸고 <strong>ASIO4ALL v2</strong>를 선택함. 설정 버튼의 이름은 프로그램마다 다르지만 Control Panel, Hardware Setup, Show ASIO Panel처럼 표시되는 경우가 많음.

DAW가 ASIO4ALL을 사용하기 시작하면 Windows 시스템 트레이에 ASIO4ALL 아이콘이 나타남. 아이콘이 없으면 현재 프로그램이 ASIO4ALL을 불러오지 않은 상태임.


## 입출력 장치 선택

컨트롤 패널의 장치 목록에서 사용할 출력과 입력만 켬. 가상악기 연주만 한다면 스피커나 헤드폰이 연결된 출력 장치만 켜도 됨. 쓰지 않는 마이크와 HDMI 출력 등을 함께 켜 두면 장치 충돌이나 클럭 문제가 생길 수 있음.

목록에서 장치가 켜졌더라도 DAW 안의 입력·출력 채널을 따로 지정해야 소리가 남.


## 버퍼 크기 조정

ASIO Buffer Size 슬라이더는 현재 선택한 장치에 적용됨.

- 64~128 samples: 지연이 짧지만 컴퓨터와 드라이버가 충분히 안정적이어야 함

- 256 samples: 실시간 가상악기 연주를 시작하기 좋은 값

- 512 samples 이상: 지연은 늘지만 끊김과 잡음이 줄어듦

처음에는 256 samples로 시작함. 딸깍거림이나 끊김이 생기면 512로 올리고, 안정적이면 128로 내려 봄. 가장 작은 값이 항상 좋은 설정은 아님.


## 처음 설치했는데 소리가 안 날 때

1. DAW에서 ASIO4ALL v2를 선택했는지 확인함.

1. ASIO4ALL 패널에서 실제 출력 장치를 켬.

1. DAW의 마스터 출력이 그 장치의 출력 채널로 연결됐는지 확인함.

1. 다른 프로그램이 같은 장치를 점유하고 있으면 닫음.

1. 해결되지 않으면 기본값을 불러온 뒤 출력 장치 하나만 켜서 다시 시험함.

ASIO4ALL은 macOS에서 쓸 수 없음. macOS는 Core Audio를 사용하며, 여러 장치를 묶어야 할 때만 macOS의 오디오 MIDI 설정에서 통합 기기를 만듦.

이 글에 관련해 의견을 나누기 위해 <a href="https://gall.dcinside.com/digitalpiano" target="_blank" style="color: inherit; text-decoration: underline;">dcinside digital piano gallery</a>에도 게시하고 있습니다. 질문이나 토론은 갤러리를 방문해주세요.



<div class="notion-columns" style="--notion-columns:3; display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1.5rem; margin:1.5rem 0; align-items:start; width:100%; max-width:100%;">

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



</div>

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



<img src="/images/ASIO4ALL-기본-설정과-사용법-1.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



</div>

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



</div>

</div>

