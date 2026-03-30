import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 빌드 타임 환경변수 주입 확인
// Jenkins: withCredentials([string(credentialsId: 'react-app-test-secret', variable: 'REACT_APP_TEST_SECRET')])
//          → docker build --build-arg REACT_APP_TEST_SECRET=$REACT_APP_TEST_SECRET
// 로컬:   REACT_APP_TEST_SECRET=hello npm run build  또는  .env.local에 추가
console.log('[BUILD ENV] REACT_APP_TEST_SECRET:', process.env.REACT_APP_TEST_SECRET ?? '(not set)');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
