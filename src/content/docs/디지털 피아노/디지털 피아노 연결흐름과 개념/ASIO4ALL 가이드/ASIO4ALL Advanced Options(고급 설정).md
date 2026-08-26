---
title: "ASIO4ALL Advanced Options(고급 설정)"
date: 2026-08-11
lastEdited: 2026-08-11
notionPageId: "3b926dfb-cd79-818e-9b38-f8a71cc62888"
tags:
  - "ASIO4ALL 2.22 기준의 설치·설정·문제 해결 가이드임."
sidebar:
  order: 3
---



<img src="/images/ASIO4ALL-Advanced-Options(고급-설정)-0.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

이 글은 <strong>ASIO4ALL 2.22</strong> 기준임. 우측 하단의 톱니바퀴 버튼을 누르면 고급 모드가 열림. 장치 목록이 Device, Device Interface, Pin 단계로 펼쳐지고, 각 입력·출력을 따로 켤 수 있음.


## 장치 목록

설정을 바꾸기 전에 대상 장치를 먼저 선택함. 버퍼와 고급 옵션은 현재 강조된 장치에만 적용됨.

- <strong>Active</strong>: 오디오 엔진에서 정상적으로 작동 중임

- <strong>Inactive</strong>: 사용할 수 있지만 아직 시작되지 않음

- <strong>Unavailable</strong>: 다른 프로그램이 사용 중이거나 현재 사용할 수 없음

- <strong>Beyond Logic</strong>: 장치가 시작되지 않거나 비정상적으로 응답함

Beyond Logic 상태라면 패널을 닫았다 다시 열거나 USB 장치를 다시 연결해 봄.


## 여러 장치 묶기

고급 모드에서는 여러 장치를 동시에 켜 통합 장치처럼 쓸 수 있음. 서로 다른 장치를 묶으려면 같은 클럭을 공유해야 안정적임. S/PDIF 등으로 클럭을 맞추지 않은 내장 사운드 장치와 USB 마이크를 함께 쓰면 시간이 지나면서 잡음과 드롭아웃이 생길 수 있음.

안정성이 중요하면 하나의 입출력 장치만 사용하는 편이 좋음.


## Latency Compensation

입력·출력 지연 보정값을 DAW에 보고하는 설정임. 실제 오디오 지연을 줄이지 않으며, 녹음된 오디오의 위치가 계속 앞뒤로 어긋날 때 측정값에 맞춰 조정함. 여러 장치를 켰다면 가장 큰 보정값이 적용됨.


## Alternative Buffer Synchronization

2.17부터 <strong>Allow Pull Mode (WaveRT)</strong>를 대신하는 옵션임. ASIO4ALL은 장치에 맞는 버퍼 동기화 방식을 자동으로 고르며, 이 옵션을 켜면 가능한 경우 다른 방식을 시험함.

기본값에서 드롭아웃이 나거나 1~2ms 정도의 지연을 더 줄여 보고 싶을 때만 바꿔 봄. 모든 장치에서 좋아지는 만능 설정은 아님.


## Buffer Offset

WaveRT 장치의 원형 버퍼를 읽고 쓰는 위치를 옮김. 기본 설정에서 주기적인 잡음이나 불안정이 생길 때 조금씩 움직여 더 안정적인 지점을 찾을 수 있음. 문제가 없다면 건드리지 않음.


## Always Resample 44.1 ↔ 48 kHz

ASIO4ALL은 장치가 44.1kHz를 지원하지 않으면 필요한 변환을 자동으로 수행함. 이 옵션을 켜면 장치가 44.1kHz를 지원한다고 보고하더라도 44.1kHz와 48kHz 사이를 ASIO4ALL이 변환함.

장치가 내부에서 불안정하게 리샘플링하거나 44.1kHz에서 잡음이 날 때 시험함. 샘플레이트가 다르다는 이유만으로 항상 켤 필요는 없음.


## Low Power Mode

2.22의 현재 옵션임. 기본값은 켜짐이며 오디오 처리 사이의 유휴 시간에 CPU 사용량을 낮춤. 일부 시스템에서는 끊김이 생길 수 있으므로 다른 설정으로 해결되지 않을 때 꺼서 비교함. 끄면 CPU 사용량과 전력 소비가 늘 수 있음.


## 2.22에서 사라진 예전 옵션

다음 항목은 현재 설정법에 넣으면 안 됨.

- <strong>Hardware Buffer</strong>: 2.17에서 제거됨

- <strong>Allow Pull Mode (WaveRT)</strong>: Alternative Buffer Synchronization으로 교체됨

- <strong>Kernel Buffers</strong>: 2026년 버전에서 폐기됨

- <strong>Force WDM Driver to 16 Bit</strong>: 2026년 버전에서 폐기됨

업데이트 뒤 예전 설정이 남아 이상하게 작동한다면 기본값 불러오기 버튼으로 2.22 권장값을 다시 적용함.

이 글에 관련해 의견을 나누기 위해 <a href="https://gall.dcinside.com/digitalpiano" target="_blank" style="color: inherit; text-decoration: underline;">dcinside digital piano gallery</a>에도 게시하고 있습니다. 질문이나 토론은 갤러리를 방문해주세요.



<div class="notion-columns" style="--notion-columns:3; display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1.5rem; margin:1.5rem 0; align-items:start; width:100%; max-width:100%;">

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



</div>

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



<img src="/images/ASIO4ALL-Advanced-Options(고급-설정)-1.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



</div>

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



</div>

</div>

