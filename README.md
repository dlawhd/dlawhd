<div align="center">

# 백엔드 중심의 풀스택 개발자, 종현입니다 👋

### 사용자 경험을 고려한 기능을 설계하고, 운영 가능한 서비스로 완성합니다.

Java·Spring Boot로 백엔드를 설계하고 React로 사용자 경험을 구현합니다.<br>
인증, 권한, 파일 저장, 실시간 기능, AI 연동처럼 서비스 운영에서 마주하는 문제를 직접 해결해 왔습니다.

<br>

<a href="https://www.esjh.shop">
  <img src="https://img.shields.io/badge/Memory_Jar-서비스_바로가기-27866D?style=flat-square" alt="Memory Jar 서비스 바로가기">
</a>
<a href="https://github.com/dlawhd/graduation">
  <img src="https://img.shields.io/badge/GitHub-프로젝트_코드-30363D?style=flat-square" alt="Memory Jar GitHub 저장소">
</a>

</div>

---

## About Me

- 요구사항을 API, 데이터 모델, 화면 흐름으로 구체화하는 개발을 좋아합니다.
- 인증·인가, 예외 처리, 파일 접근 제어처럼 사용자에게 보이지 않는 안정성까지 함께 설계합니다.
- 기능 구현에 그치지 않고 테스트, 로그, 배포 환경을 확인하며 문제의 원인을 끝까지 추적합니다.
- 새로운 기능도 기존 서비스의 호환성과 운영 비용을 고려해 작은 단위로 개선합니다.

---

## Tech Stack

**Backend**

![Java](https://img.shields.io/badge/Java-27866D?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-27866D?style=flat-square&logo=springboot&logoColor=white)
![Spring Security](https://img.shields.io/badge/Spring_Security-27866D?style=flat-square&logo=springsecurity&logoColor=white)
![JPA](https://img.shields.io/badge/JPA-27866D?style=flat-square&logo=hibernate&logoColor=white)

**Frontend**

![React](https://img.shields.io/badge/React-327F84?style=flat-square&logo=react&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-327F84?style=flat-square&logo=javascript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-327F84?style=flat-square&logo=tailwindcss&logoColor=white)

**Data & Infrastructure**

![MariaDB](https://img.shields.io/badge/MariaDB-14594C?style=flat-square&logo=mariadb&logoColor=white)
![AWS EC2](https://img.shields.io/badge/AWS_EC2-14594C?style=flat-square&logo=amazonec2&logoColor=white)
![AWS S3](https://img.shields.io/badge/AWS_S3-14594C?style=flat-square&logo=amazons3&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-14594C?style=flat-square&logo=docker&logoColor=white)

---

## Featured Project

### Memory Jar | 함께 기록한 추억을 약속한 날 다시 여는 웹 서비스

친구, 가족, 연인과 저금통을 만들고 사진·영상·메시지를 함께 기록한 뒤, 정해진 날짜에 다시 열어볼 수 있는 서비스입니다.

**기술**<br>
`Java 17` `Spring Boot` `Spring Security` `React` `MariaDB` `AWS EC2` `AWS S3` `Docker`

**주요 구현**

- 자체 로그인과 Google·Naver·Kakao 소셜 로그인을 통합하고, 저금통 멤버별 권한을 분리했습니다.
- 저금통 초대, 추억 쪽지, 사진·영상 첨부, 실시간 채팅·알림을 구현했습니다.
- 예약된 날짜에 저금통을 공개하고, 하루 한 장의 추억을 뽑는 흐름을 만들었습니다.
- S3 Presigned URL을 사용해 파일 접근 시간을 제한하고, 만료된 이미지 URL을 다시 발급받을 수 있도록 처리했습니다.
- Cloudflare Workers AI로 원본 그림에서 여러 디자인 후보를 생성하고, 슬롯 배치·다중 영역 누끼·투명 PNG 생성까지 이어지는 AI 저금통 디자인 기능을 구현했습니다.
- AI 요청 실패, 이미지 정리, 만료 URL 재발급 등 운영 중 발생할 수 있는 상태를 사용자 안내와 서버 로그로 구분해 처리했습니다.

**개발하며 집중한 점**

- 외부 AI·S3 호출이 DB 트랜잭션을 오래 점유하지 않도록 분리하고, 실패 원인을 추적할 수 있는 오류 코드와 로그를 남겼습니다.
- 목록 조회에서 AI 디자인 정보를 함께 읽도록 구성해 불필요한 반복 조회를 줄였습니다.
- AI 후보·원본 이미지의 수명 주기를 관리하고, 최종 디자인만 저금통에 유지하도록 정리 정책을 구현했습니다.

[🌐 서비스 방문하기](https://www.esjh.shop) · [💻 소스 코드 보기](https://github.com/dlawhd/graduation)

---

## Currently Interested In

- Spring Boot 기반 서비스의 안정적인 운영과 관측 가능성
- 인증·인가와 파일 접근 제어를 포함한 웹 서비스 보안
- AI 기능을 사용자 흐름에 자연스럽게 연결하는 백엔드 설계

---

## GitHub Activity

![실제 GitHub 기여 기록으로 만든 민트색 탁구대](https://raw.githubusercontent.com/dlawhd/dlawhd/pingpong-output/pingpong.svg)

---

## Contact

- GitHub: [github.com/dlawhd](https://github.com/dlawhd)

<div align="center">

꾸준히 기록하고, 개선하며, 신뢰할 수 있는 서비스를 만들겠습니다. 🌱

</div>
