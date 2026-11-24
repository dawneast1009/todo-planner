# 설정 가이드

## 로컬에서 실행

```sh
npm install
npm run dev      # 개발 서버
npm test         # 테스트
npm run build    # 배포용 빌드 (dist/)
```

Firebase 설정이 없으면 **로컬 모드**로 동작해요. 데이터는 그 브라우저에만 저장되고 기기끼리 동기화되지 않아요.

## 폰·PC 동기화 (Firebase, 무료 Spark 요금제)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만든다. Google 애널리틱스는 꺼도 된다.
2. **Authentication → 시작하기 → 로그인 방법**에서 `이메일/비밀번호`를 켠다. Google 로그인도 쓰려면 `Google`도 켠다.
3. **Authentication → 설정 → 승인된 도메인**에 `<GitHub 사용자명>.github.io`를 추가한다.
4. **Firestore Database → 데이터베이스 만들기**를 누르고, 위치는 `asia-northeast3 (서울)`, 모드는 프로덕션으로 고른다.
5. **Firestore → 규칙**에 레포의 [`firestore.rules`](../firestore.rules) 내용을 붙여넣고 게시한다. 이렇게 하면 로그인한 사람이 자기 데이터만 읽고 쓸 수 있다.
6. **프로젝트 설정 → 내 앱 → 웹 앱 추가(</>)**를 누르고 나오는 `firebaseConfig` 값을 아래에 넣는다.
   - 로컬: `.env.example`을 `.env.local`로 복사해서 값을 채운다. 이 파일은 git에 올라가지 않는다.
   - 배포: GitHub 저장소 **Settings → Secrets and variables → Actions → Variables**에
     `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`를 추가한다.
7. Actions에서 Deploy를 다시 실행하거나 새로 푸시하면 로그인 화면이 나온다. 처음 한 번 "계정 만들기"를 누른 뒤, 다른 기기에서는 같은 계정으로 로그인하면 된다.

> Firebase 웹 설정값은 비밀번호 같은 비밀 키가 아니라 공개 식별자예요. 실제 보호는 5번의 보안 규칙이 맡아요.

## 나이스 인증키 (시간표·학사일정)

키가 없어도 동작하지만, 나이스는 키 없는 요청에 **한 번에 5건까지만** 줘요. 그래서 시간표가 5교시까지만 보이고 학사일정도 일부만 보여요.

1. [나이스 교육정보 개방 포털](https://open.neis.go.kr)에 가입한다.
2. 마이페이지에서 인증키를 신청한다. 무료이고 바로 발급된다.
3. 앱의 **설정 → 나이스 인증키**에 넣는다. 키는 레포가 아니라 내 계정 데이터(또는 로컬 모드라면 그 브라우저)에만 저장된다.

## 배포 (GitHub Pages)

`main`에 푸시하면 `.github/workflows/deploy.yml`이 테스트하고 빌드해서 GitHub Pages에 올린다. 주소는 `https://<사용자명>.github.io/todo-planner/`.
