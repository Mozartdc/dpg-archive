---
title: "E2x2 OTG 한글 매뉴얼"
date: 2026-03-17
lastEdited: 2026-03-19
notionPageId: "32626dfb-cd79-80ff-8543-fc85b6d6cfab"
tags:
  - "토핑 매뉴얼"
sidebar:
  order: 9999
---



<img src="/images/E2x2-OTG-한글-매뉴얼-0.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />


### Contents

1. 구성품 목록

1. 제품 기본 사양

1. 각 부 명칭

1. 연결

1. TOPPING Professional Control Center

1. DAW에서의 오디오 설정

1. Troubleshooting

1. 주의사항

1. 주요 사양(@24bit/96kHz)

---


## 1. 구성품 목록



<img src="/images/E2x2-OTG-한글-매뉴얼-1.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

E2x2 OTG 본체 1개, Type-A to Type-C 케이블 1개, Type-C to Type-C 케이블 1개, 6.35mm to 3.5mm 어댑터 1개, 퀵 가이드 1부.

---


## 2. 제품 기본 사양


| 항목 | 내용 |
| --- | --- |
| 크기 | 18.7cm × 12.9cm × 5.0cm(돌출부 포함) |
| 무게 | 530g |
| 전원 공급 | USB Type-C 입력, DC 5V / 0.8A |
| 인터페이스 | Type-C: USB 2.0 (HS), OTG: USB 2.0 (FS) |
| 마이크 입력 | 2채널, 콤보 단자, 48V 팬텀 전원 지원 |
| 악기 입력 | 2채널, 콤보 단자 |
| 라인 입력 | 2채널, 콤보 단자 |
| 라인 출력 | 2채널, 6.35mm TRS |
| AUX 출력 | 1개, 3.5mm 스테레오 |
| 헤드폰 출력 | 1개, 6.35mm 스테레오 |
| S/PDIF 출력 | 1개, 광 출력 |
| 직접 모니터링 | 지원, 모니터 믹스 조절 가능 |
| 입력 레벨 표시 | 지원, 2×8 LED |
| 출력 레벨 표시 | 지원, 2×8 LED |
| 프리앰프 기술 | Ultra-linear |
| 재생 기술 | NFCA-LE |
| OTG 기술 | Digital ASRC |
| 지원 샘플레이트 | Type-C: 24bit/44.1kHz~24bit/192kHz, OTG: 16bit/48kHz~24bit/48kHz, S/PDIF: 24bit/44.1kHz~24bit/192kHz |
| 소프트웨어 제어 | 지원, TOPPING Professional Control Center |
| DAW 채널 수 | 8채널 |
| 내부 채널 수 | 6채널 |
| 지원 운영체제 | Mac / Win / iOS / Android |
| 동시 작업 | 지원 |
| 전원 스위치 | 있음 |

---


## 3. 각 부 명칭


### 전면 패널



<img src="/images/E2x2-OTG-한글-매뉴얼-2.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

1. IN1&IN2
  마이크, 악기, 라인 레벨 기기를 연결하는 입력 단자임. XLR과 6.35mm 밸런스/언밸런스 콤보 플러그를 모두 지원함. 마이크는 XLR 플러그, 악기는 6.35mm TS 플러그, 라인 레벨 기기는 6.35mm TRS 플러그로 연결.


1. INST
  입력 게인과 입력 임피던스를 바꾸는 버튼. 라인 입력과 악기 입력을 여기서 전환함. 표시등이 꺼져 있으면 라인 입력 상태임. 표시등이 켜져 있으면 악기 입력 상태임.


1. 48V
  마이크 입력용 팬텀 전원 스위치임. 표시등이 켜지면 해당 XLR 입력에 48V 팬텀 전원이 공급됨.


<strong>! 주의</strong>

팬텀 전원은 콘덴서 마이크에만 필요함. 필요하지 않은 장비에 공급하면 손상될 수 있으므로 필요할 때만 켜야 함. 팬텀 전원을 켜거나 끄기 전에는 볼륨을 최소로 낮춰야 함.

1. 입력 게인 노브
  입력 라인의 게인을 조절함. 반시계 방향으로 돌리면 게인이 줄고, 시계 방향으로 돌리면 게인이 커짐. 조정할 때는 입력 미터를 확인해야 함. CLIP 표시가 켜지면 게인을 낮춰야 함.


1. MON
  직접 모니터링을 켜는 버튼. 모노 입력 신호를 헤드폰 출력의 좌우 채널로 직접 보내므로 듀얼 모노 모니터링이 가능함.


1. LED 미터
  IN1&2는 입력 미터. OUT1&2는 출력 미터임. 신호가 빨간색 CLIP 지점에 도달하면 클리핑 상태이므로 신호 레벨을 낮춰야 함.


1. 전원 표시등
  계속 켜져 있으면 동작 상태, 꺼져 있으면 전원이 꺼진 상태임. 천천히 깜박이면 대기 상태임.


자동 대기 기능이 켜져 있을 때 USB 신호 없이 전원만 감지되면, IN1과 IN2에 신호가 들어와도 1분 뒤 대기 상태로 들어감. USB 신호가 감지되면 자동으로 다시 동작 상태로 돌아감. 자동 대기 기능은 TOPPING Professional Control Center에서 톱니바퀴 모양의 설정에서 제어.

1. OTG 표시등
  계속 켜져 있으면 OTG 포트에 기기가 연결된 상태, 꺼져 있으면 OTG 포트에 연결된 기기가 없는 상태임.


1. 모니터 믹스
  MON 버튼을 누른 뒤 이 노브로 실시간 입력 신호와 컴퓨터 재생 신호 사이의 비율을 조절함. 반시계 방향으로 돌리면 입력 신호 비율이 커짐. 시계 방향으로 돌리면 재생 신호 비율이 커짐. 이 노브는 입력 신호의 녹음 레벨에는 영향을 주지 않음.


1. 헤드폰 볼륨 조절
  헤드폰 출력 볼륨을 조절함. 반시계 방향으로 돌리면 줄고, 시계 방향으로 돌리면 커짐.


1. 6.35mm 헤드폰 출력 잭
  6.35mm 헤드폰을 연결하는 단자.


1. GAIN
  헤드폰 게인 설정 버튼임. 표시등이 꺼져 있으면 Low GAIN. 표시등이 켜져 있으면 High GAIN.


1. MONITOR
  모니터 출력의 LINE OUT 레벨과 AUX OUT 레벨을 조절함. 반시계 방향으로 돌리면 줄고, 시계 방향으로 돌리면 커짐.



### 후면 패널



<img src="/images/E2x2-OTG-한글-매뉴얼-3.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

1. LINE OUT 
  6.35mm TRS 밸런스 출력 잭임. 액티브 스피커나 앰프를 연결함.


1. AUX OUT
  3.5mm 스테레오 출력 단자.


1. OPTICAL OUT
  광 S/PDIF 출력 단자.


1. OTG
  모바일 기기를 연결하는 단자임. 모바일 기기의 오디오를 컴퓨터로 녹음할 때 쓰며, 반대로 오디오를 모바일 기기로 보낼 때도 사용함.


1. USB-C
  동봉된 USB 케이블로 컴퓨터와 연결하는 단자. USB 포트의 전원 공급 상태에 따라 E2x2 OTG에 전원도 함께 공급됨.


1. POWER
  특히 모바일 기기나 태블릿을 연결했을 때 USB 포트 전원이 부족하면 DC 5V 전원을 연결함. 이 경우 옆의 USB-C 포트는 전원 입력에 사용하지 않고 데이터 전송에만 사용함.


1. 전원 스위치
  기기의 전원을 켜고 끄는 스위치임.



<img src="/images/E2x2-OTG-한글-매뉴얼-4.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



<img src="/images/E2x2-OTG-한글-매뉴얼-5.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



### 공장 초기화

기기 전원을 켤 때 좌측 상단의 MON 버튼을 길게 누른 채 모든 미터 표시등이 켜질 때까지 유지하면 공장 설정으로 복원됨.

---


## 4. 연결


### 연결



<img src="/images/E2x2-OTG-한글-매뉴얼-6.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



<img src="/images/E2x2-OTG-한글-매뉴얼-7.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

외부 기기를 연결하거나 분리할 때 큰 출력음으로 고장이나 청각 손상이 생길 수 있으므로, 연결 전 볼륨을 모두 최소로 낮춰야 함.


### USB 모드 설정

USB-C 포트에는 PC 또는 모바일 기기를 직접 연결할 수 있음. 연결 대상에 맞게 PC 모드 또는 모바일 모드로 설정해야 함.

기기 전원을 켜는 동안 전면의 IN1 48V 버튼을 길게 누르면 설정 모드로 들어감.

48V 버튼을 눌러 모드를 전환함.

- PC 모드에서는 표시등 8개가 켜짐.

- 모바일 모드에서는 표시등 4개가 켜짐.

설정을 변경한 뒤 전원을 끄고 다시 켜야 적용됨.

---


## 5. TOPPING Professional Control Center

TOPPING Professional Control Center의 사용 가이드 다운로드 링크




<a href="https://download.topping.pro/downloads/ToppingPro%20V1.6.pdf" target="_blank" style="display: block; border: 1px solid #e5e7eb; border-radius: 6px; text-decoration: none; color: inherit; margin: 16px 0; padding: 16px; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
  <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #111827; word-break: break-all; overflow-wrap: anywhere;">🔗 https://download.topping.pro/downloads/ToppingPro%20V1.6.pdf</div>
  
  <div style="font-size: 11px; color: #9ca3af; word-break: break-all;">https://download.topping.pro/downloads/ToppingPro%20V1.6.pdf</div>
</a>

---


## 6. DAW에서의 오디오 설정

E2x2 OTG는 Mac에서는 Core Audio, Windows에서는 ASIO를 지원하는 모든 DAW와 호환됨.

E2x2 OTG는 Mac의 Core Audio와 Windows의 ASIO를 지원하는 모든 DAW에서 사용할 수 있음.

DAW의 오디오 설정에서 입력 장치와 출력 장치로 E2x2 OTG를 선택함.

Windows에서는 ASIO 드라이버를, Mac에서는 Core Audio 드라이버를 선택함.

구체적인 설정 방법은 사용하는 각 DAW의 사용 설명서를 참고.

---


## 7. Troubleshooting


### 전원이 켜지지 않음

후면 전원 스위치가 켜져 있는지 확인함.

전원 공급이 부족할 수 있으므로 POWER 단자에 DC 5V 전원을 연결해 봄.

USB 케이블이 손상되었을 수 있으므로 새 케이블로 바꿔 보고, USB 케이블 길이는 2m 이하를 권장함.

컴퓨터의 다른 USB 포트에 연결해 보거나, 다른 컴퓨터에서도 시험해 봄.


### 재생 소리가 들리지 않음

스피커 연결 상태와 스피커 볼륨을 확인함.

E2x2 OTG의 라인 출력 및 헤드폰 출력 볼륨을 조절함.

ToppingPro 설정을 확인함.

USB 허브를 거치지 말고 컴퓨터에 직접 연결해 봄.

사용하지 않는 다른 USB 장치를 제거한 뒤 다시 확인함.

실행 중인 응용 프로그램을 모두 종료한 뒤 다시 확인함.


### 녹음 소리가 너무 크거나 너무 작거나 아예 없음

E2x2 OTG의 입력 게인 레벨을 조절함.

콘덴서 마이크에 48V 팬텀 전원이 필요하면 팬텀 전원을 켬.

ToppingPro 설정을 확인함.


### 소리가 끊김

오디오 응용 프로그램 또는 ToppingPro에서 버퍼 크기와 레이턴시를 더 크게 설정함. Windows 전용 항목임.

다른 컴퓨터에서도 test 해 봄.


### 입력 단자에 연결된 기기의 소리가 왜곡됨

입력 미터를 확인함. 클리핑 표시가 켜지면 입력 게인을 낮춤.


### 재생 또는 녹음이 되지 않음

사용 중인 소프트웨어에서 E2x2 OTG가 입력 및 출력 장치로 설정되어 있는지 확인함.

E2x2 OTG가 컴퓨터에 제대로 연결되어 있는지 확인함.

E2x2 OTG를 사용하는 소프트웨어를 모두 종료한 뒤 USB 케이블을 뽑았다가 다시 연결함.


### 모바일에서 이 기기를 인식하지 못함

일부 스마트 폰은 먼저 OTG 기능을 활성화해야 함.

사용 중인 USB 케이블이 OTG 기능을 지원해야 함.

전원 공급이 부족할 수 있으므로 POWER 단자에 DC 5V 전원을 연결해 봄.

스마트 폰을 USB-C 포트에 연결했다면 기기를 모바일 모드로 설정해야 함.

---


## 8. 주의사항

고온다습한 환경과 기기에 강한 충격을 피할 것.
제품을 임의로 분해하면 보증이 무효가 됨.
실내용으로만 사용해야 함.
E2x2 OTG의 고장으로 직간접적으로 발생한 손실이나 손해에 대해 Topping은 책임을 지지 않음.
제품 개선을 위해 사양은 예고 없이 바뀔 수 있음.

---


## 9. 주요 사양 (@24bit/96kHz)


### 마이크 입력

입력 환산 잡음 @A-wt, 150 Ohm: -130.5dBu

THD+N @A-wt: -110dB (0.0003%)

다이내믹 레인지 @A-wt: 115dB

SNR @A-wt: 115dB

크로스토크 @1kHz: -140dB

주파수 응답: 20Hz~40kHz (±0.2dB)

최대 입력 레벨: 8.6dBu

입력 임피던스: 1.5k Ohms

사용 가능 게인: 58dB + 20dB (20dB 디지털 게인)

팬텀 전원: 48V

커넥터 형식: 콤보 소켓의 XLR 단자


### 라인 입력

THD+N @A-wt: -107dB (0.00045%)

다이내믹 레인지 @A-wt: 115dB

SNR @A-wt: 115dB

크로스토크 @1kHz: -140dB

주파수 응답: 20Hz~40kHz (±0.1dB)

최대 입력 레벨: 23.9dBu

입력 임피던스: 9k Ohms

사용 가능 게인: 58dB + 20dB (20dB 디지털 게인)

커넥터 형식: 콤보 소켓의 TRS 단자


### 악기 입력

THD+N @A-wt: -108dB (0.0004%)

다이내믹 레인지 @A-wt: 115dB

SNR @A-wt: 115dB

크로스토크 @1kHz: -140dB

주파수 응답: 20Hz~40kHz (±0.3dB)

최대 입력 레벨: 14.8dBu

입력 임피던스: 1M Ohms

사용 가능 게인: 58dB + 20dB (20dB 디지털 게인)

커넥터 형식: 콤보 소켓의 TS 단자


### 라인 출력

THD+N @A-wt: -100dB (0.001%)

다이내믹 레인지 @A-wt: 115dB

아날로그 다이내믹 레인지 @A-wt, -40dB 감쇠: 127dB

SNR @A-wt: 115dB

크로스토크 @1kHz: -128dB

주파수 응답: 20Hz~40kHz (±0.3dB)

최대 출력 레벨: 14dBu

잡음 @A-wt: 1.8uVrms

출력 임피던스: 100 Ohms

커넥터 형식: 6.35mm TRS 밸런스 잭


### AUX 출력

THD+N @A-wt: -100dB (0.001%)

다이내믹 레인지 @A-wt: 115dB

아날로그 다이내믹 레인지 @A-wt, -40dB 감쇠: 122dB

SNR @A-wt: 115dB

크로스토크 @1kHz: -108dB

주파수 응답: 20Hz~40kHz (±0.5dB)

최대 출력 레벨: 8dBu

잡음 @A-wt: 1.5uVrms

출력 임피던스: 50 Ohms

커넥터 형식: 3.5mm TRS 스테레오 출력 잭


### 헤드폰 출력

THD+N @A-wt: -100dB (0.001%)

다이내믹 레인지 @A-wt: 115dB

아날로그 다이내믹 레인지 @A-wt, -40dB 감쇠: 132dB

SNR @A-wt: 115dB

크로스토크 @1kHz: -120dB

주파수 응답: 20Hz~40kHz (±0.3dB)

최대 출력 레벨: 0dBu @ Gain=L / 17dBu @ Gain=H

잡음 @A-wt: 1uVrms

출력 임피던스: 1 Ohm

커넥터 형식: 6.35mm 스테레오 헤드폰 잭

출력 파워: 580mW × 2 @32Ω, THD+N<1%

출력 파워: 380mW × 2 @64Ω, THD+N<1%

출력 파워: 198mW × 2 @150Ω, THD+N<1%

출력 파워: 105mW × 2 @300Ω, THD+N<1%

출력 파워: 55mW × 2 @600Ω, THD+N<1%


### OTG 출력

측정 조건: OTG 24bit/48kHz <-> Type-C 24bit/44.1kHz~192kHz

THD+N @A-wt: -130dB (0.00003%)

다이내믹 레인지 @A-wt: 138dB

SNR @A-wt: 138dB

크로스토크 @1kHz: -154dB

주파수 응답: 20Hz~40kHz (±0.1dB)

최대 출력 레벨: -0.5dBFS

커넥터 형식: OTG (Type-C)


### S/PDIF 출력

측정 조건: USB IN 24bit/44.1kHz~192kHz

THD+N @A-wt: -144dB (0.000006%)

다이내믹 레인지 @A-wt: 144dB

SNR @A-wt: 144dB

크로스토크 @1kHz: -160dB

주파수 응답: 20Hz~40kHz (±0.01dB)

최대 출력 레벨: 0dBFS

커넥터 형식: Optical OUT

*모든 수치는 TOPPING 연구실 측정값임.

