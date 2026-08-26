---
title: "디지털 피아노와 PC 연결"
date: 2026-08-11
lastEdited: 2026-08-25
notionPageId: "3b926dfb-cd79-81d4-9110-dc9f95582376"
tags:
  - "가상악기와 DAW 녹음을 위한 USB MIDI·USB Audio 및 오디오 인터페이스 구성을 설명함."
sidebar:
  order: 9
---



<img src="/images/디지털-피아노와-PC-연결-0.png" alt="디지털 피아노 연결 및 홈 스튜디오 구성" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



<img src="/images/디지털-피아노와-PC-연결-1.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

디지털 피아노와 PC 연결의 주 목적은

- 가상악기 사용

- DAW(시퀀서)를 이용한 정밀한 미디 녹음

두가지로 나눌 수 있음. 

아래 항목에 시리즈로 관련한 내용을 올림.


## 디지털 피아노 PC 연결과 레이턴시

디지털 피아노(MIDI) - PC(가상악기) - 윈도우 기본 사운드 드라이버 - PC 헤드폰 단자

의 구성으로 쓰면 소리가 처리되어 나오기까지 보통 0.05초~0.1초(50ms~100ms) 이상 걸림. 체감상 건반을 치면 반 박자 늦게 소리가 나는 느낌임.

Mac 유저라면, Core Audio 시스템이 꽂기만하면 다른 설장 없이도 레이턴시 없이 끝남.

그런데, Windows의 기본 드라이버(DirectSound, MME 등)는 음악 감상용이지, 실시간 연주용이 아니라서 레이턴시를 별도로 잡아줘야 함.


### <strong>해결 방법은 크게 두가지임</strong>


### <strong>1. 드라이버를 통한 해결</strong>

a. 내 디피에 USB 오디오 인터페이스 기능이 있는 경우

- 제조사 공식 드라이버 설치 (야마하 Steinberg USB Driver, 롤랜드 등).

b. 제조사 드라이버가 없으면 ASIO4ALL 사용


### <strong>2. 오디오 인터페이스 구매</strong>

이 방법에 관해서 아래 시리즈로 계속 업데이트 함.


## 오디오 인터페이스 & 미디 장비용 USB 허브

디지털 피아노를 PC에 연결하면 사정에 따라 USB 허브가 필요할 수 있음. 

아주 이상한것만 사지 않으면 대체로 큰 문제 없는데, 혹시 새로 사려고 알아보는 게이가 있을까 해서 가이드를 써봄.

추천부터 하면,



<img src="/images/디지털-피아노와-PC-연결-2.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

아트뮤 8-in-1 MH410 (내가 쓰는 제품)



<img src="/images/디지털-피아노와-PC-연결-3.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

아트뮤? 브랜드가 챙피하거나 색상이 마음에 안들면

Anker 555 USB-C 허브8-in-1 추천


### <strong>USB 허브 고를때는</strong>


### <strong>1. 유전원 허브</strong>

PD (유전원) 방식을 사는 걸 추천함. 무전원 허브는 여기저기서 전력을 끌어가다보면 연결 끊김이 생길 수 있음.


### <strong>2. 디스플레이 포트가 적을수록 좋음.</strong>

USB 허브에서 발열이 가장 많은게 영상을 처리하는 칩셋임. 모니터를 연결하지 않아도 대기전력 상태라 꾸준히 온도가 올라감.

물론, 대기전력만으로 미디신호가 튈 정도의 발열은 안나지만

11 in 1 같은 모델처럼 영상 단자가 3~4개씩 되면 무시할 정도는 아님.



<img src="/images/디지털-피아노와-PC-연결-4.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

스펙을 볼 때는 

- USB 단자가 많은 게 오디오용으로는 가장 좋고

- 오디오 데이터는 USB 2.0으로도 충분할만큼 가볍지만, 여러 장비를 동시에 쓸 때 병목 현상이 없어야 하니까 USB 3.0 (5Gbps) 이상이 좋음.

위 사진처럼 USB 10Gbps가 3개면 아주 좋음.

허브를 쓰면 음질 떨어지는지 걱정하는 사람도 있는데, 디지털 데이터(0과 1) 전송라서 허브 거친다고 변하지 않음. 그런데, 전원이 불안정하면 틱하는 잡음이 섞이거나 소리가 끊길 수는 있음. 

그래서 유전원을 써야함.

또 반드시 접지가 된 콘센트에 전원을 연결해서 써야함.


## 디지털 피아노 가상악기 정보 시리즈

디지털 피아노와 가상악기(Virtual Instrument)의 차이와 연주 셋업법 정리함.


### <strong>1부는 가상악기가 뭔지, 왜 쓰는지에 대한 내용이고</strong>


### <strong>2부는 어떻게 셋업하는지 실제 장비와 방법 정리함.</strong>

그리고 아래는 가상악기별 추천 목록과 사용 가이드이고 계속 업데이트중임

아래는 가상악기를 돌리기 위해 꼭 필요한 드라이버 ASIO4ALL의 사용 방법을 모은 시리즈 링크임.

*ASIO4ALL은 다양한 DAW에서 저지연 오디오 처리를 가능하게 하는 가상 오디오 드라이버임.

아래는 <strong>무료로 사용 가능한 가상악기</strong> 안내글인데, 이것도 시간 날 때마다 업데이트 함.


### <strong>아래는 가상악기 없이 기본 음색 조절 관련 글임</strong>


### <strong>그 외 기타 가상악기 소개</strong>


## 무료 DAW 모음.


### <strong>Cakewalk Sonar</strong>



<img src="/images/디지털-피아노와-PC-연결-5.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

윈도우에선 Cakewalk Sonar를 가장 많이 씀.

위 링크에서 다운 받고, 설치하고나면 BandLab 계정이 필요하니까 가입하면 되는데, 유료 버전(Sonar)이 아니라 무료 계정인지 확인해서 가입하면 됨.


### <strong>GarageBand</strong>



<img src="/images/디지털-피아노와-PC-연결-6.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />


### <strong>맥이면 기본 제공되는 GarageBand 쓰면됨. </strong>

나중에 Logic Pro로 넘어갈 때도 적응하기가 좋음.


### <strong>Reaper</strong>



<img src="/images/디지털-피아노와-PC-연결-7.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

Reaper는 유료 DAW인데, 체험판 기간(60일)이 지나도 기능 제한 없이 계속 쓸 수 있어서 사실상 무료임.

체험기간 끝나면 구매 할거냐고 창이 뜨는데, 5초 지나면 끌 수 있음.

처음 Reaper를 깔면 거의 Windows XP시절 분위기의 창이 뜨는데, Theme 기능이 있어서 구글에 Reaper Theme 검색하면 



<img src="/images/디지털-피아노와-PC-연결-8.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

이렇게 멀쩡한 DAW 레이아웃으로 쓸 수 있음.

케이크워크보다 레이턴시가 낮고, RAM점유율도 낮음. 유니버설 트랙이라 라우팅 자유도가 높음. 

그리고, Python, EEL 같은 언어를 지원해서 DAW의 거의 모든 기능을 코드로 제어할 수 있음. 

코딩으로 어떤 음역대의 MIDI 노트만 자동으로 골라서 벨로시티를 어떻게 변경하고, 자동으로 트랙 이름을 바꾸는 작업을 코딩해서 버튼 하나로 만들 수 있음.

코딩만 할 줄 알면 엄청나게 많은 확장 기능을 추가할 수 있음.

윈도우 맥 모두 지원함.



<img src="/images/디지털-피아노와-PC-연결-9.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />


### <strong>Pro Tools Intro</strong>

레코딩 스튜디오 표준인 Pro Tools의 무료 버전임. (클래식 음반에선 표준이 아님)

예전에도 Pro Tools에서 Pro Tools First라고 무료 DAW를 만들었었는데, Pro Tools랑 메뉴도 다르고 사용 방법 다른 거리서 망하고 Pro Tools Intro가 다시 나옴.

이건 Pro Tools랑 똑같고 오디오 트랙 8개, 미디 트랙 8개라는 제한만 있음. 


### <strong>LUNA</strong>

Universal Audio에서 만든 DAW임. 

DAW인데도 내부적으로 아날로그 믹서 회로를 시뮬레이션해서 소리를 섞음. 그래서 소리가 전반적으로 더 따뜻하고, 넓게 들리는 착색효과가 있음.

MIDI작업보다는 레코딩/믹싱 중심 워크플로우라서 테이프 에뮬레이션, 콘솔 서밍 등 UA 팬들에겐 인기가 좋음.

그리고 맥 전용이었다가 윈도우용이 나온지 얼마 안되서 아직 윈도우 버그들이 좀 있다고 함.


### <strong>Tracktion Waveform</strong>

Tracktion Waveform도 있는데, 윈도우, 맥 다 지원하면서 트랙 수 제한이 없음. 

그런데 인터페이스가 좀 특이해서 적응하는 데 시간이 조금 걸림.


## 유료 DAW 모음


### <strong>Cubase Artist 15</strong>


### <strong>Cubase pro 15</strong>



<img src="/images/디지털-피아노와-PC-연결-10.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

 우선, Artist와 pro의 차이는


### <strong>Pro에만 있는 기능</strong>

- VSL(Vienna Symphonic Library같은 가상악기를 쓸 때, 수십가지가 넘는 악기 주법을 화면 하단에 버튼으로 배치가 가능함. 복잡한 악기를 다룰 때 세팅이 간편해짐.

- 미디 데이터와 트랙을 조건문(If/Then/Else)과 Boolean 연산을 통해 일괄 처리하는 코딩 제어가 가능.

- 사보 프로그램 Dorico 엔진이 일부 탑재되어, 좀 더 수월한 악보 작업이 가능.

이 외엔 모두 같고, 오케스트라 작업이나 코딩이 필요할 정도로 큰 미디 작업을 하는 개 아니라면 Artist로도 충분함.

가격은

직장인/무직 Artist 479,000 Pro 829,000

대학생 Artist 299,000 Pro 529,000

이번 11월에 나온 새 버전이고, VST3 규격을 만든 회사라서 가상악기 컨트롤 기능이 가장 안정적임.


### <strong>Logic pro</strong>



<img src="/images/디지털-피아노와-PC-연결-11.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

맥을 쓴다면 Logic Pro가 가성비 최고임. 한 번 사면 메이저 업데이트가 무료인게 가장 큼. 

또 맥 전용이라 가상악기 여러개 띄워도 최적화가 잘 되어 있어서시스템 부하도 낮음

직장인/무직 299,000원

대학생 299,000원(대신 여기엔 Final Cut Pro 449,000과 기티 등등이 들어있는 패키지임)


### <strong>Ableton Live 12</strong>



<img src="/images/디지털-피아노와-PC-연결-12.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



<img src="/images/디지털-피아노와-PC-연결-13.jpg" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />

Ableton의 어레인지먼트 뷰와 세션 뷰+디테일 편집 창임.

정해진 악보 없이 즉흥적으로 피아노를 치면서 아이디어를 모으는 스타일에 적합하고, EDM이나 힙합에서 많이 씀.

이것도 코딩으로 신디사이저, 이펙터, 미디 처리 장치를 만들 수 있음.

가격 suite 기준 999,000

그런데, SSL 2+ (오인페)를 399,900원 사면, Ableton Live 12 Standard가 따라옴.

25년 12월 31일에 끝남.


### <strong>Studio One 7</strong>

VSL 등의 가상악기 제작사와 협력해서, 복잡한 설정 없이도 악기의 모든 주법을 자동으로 DAW에 연동됨.

가상악기 로딩, 이펙터 적용, 미디 데이터 이동 등 거의 모든 작업이 마우스 드래그만으로 가능해서 메뉴를 찾아 들어갈 일이 거의 없어 편리함.

원래 Studio One이 가볍고 직관적인 인터페이스가 큰 장점이었는데, 버전 7에 기능이 너무 많이 추가되면서 메뉴가 복잡해지고, 예전만큼 가볍지가 않음.

이것도 아래 링크에서 Quantum ES 2를 사면, Studio One 7영구 버전이 따라옴.

결론

윈도우는 Cubase

맥은 Logic pro

이 글에 관련해 의견을 나누기 위해 <a href="https://gall.dcinside.com/digitalpiano" target="_blank" style="color: inherit; text-decoration: underline;">dcinside digital piano gallery</a>에도 게시하고 있습니다. 질문이나 토론은 갤러리를 방문해주세요.



<div class="notion-columns" style="--notion-columns:3; display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1.5rem; margin:1.5rem 0; align-items:start; width:100%; max-width:100%;">

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



</div>

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



<img src="/images/디지털-피아노와-PC-연결-14.png" alt="" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0;" />



</div>

<div class="notion-column" style="min-width:0; width:100%; max-width:100%; overflow:hidden;">



</div>

</div>

