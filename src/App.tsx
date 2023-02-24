/* src/App.js */
import React, { useState } from 'react';
import { Amplify, API, I18n } from 'aws-amplify';
import {AmplifyUser} from '@aws-amplify/ui';
import awsExports from "./aws-exports";
import {withAuthenticator, translations, WithAuthenticatorProps } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { Configuration, OpenAIApi, CreateCompletionRequest } from 'openai'
import { MainContainer, ChatContainer, MessageType, 
  Avatar, TypingIndicator, MessageModel,InfoButton,
  MessageList, Message, MessageInput, 
  ConversationHeader } from '@chatscope/chat-ui-kit-react';
 
const OPENKEY_REG = /^sk-\w{48}$/;
const OPENKEY_STORAGE_NAME = "openaiKey";
// 设置语言
I18n.putVocabularies(translations);
I18n.setLanguage('zh');
// 设置amplify
Amplify.configure(awsExports);

interface AppMsg extends MessageModel {
  avatar : string;
}

const App = (authProps : WithAuthenticatorProps) => {
  const [openKey, setOpenKey] = useState(localStorage.getItem(OPENKEY_STORAGE_NAME));
  const [waitingAI, setWaitingAI] = useState(false);
  const [msgList, setMsgList] = useState(new Array<AppMsg>({
    message: "你好我是AI机器人, 详细介绍请点击右上角的帮助按钮.",
    type : "text",
    direction: "incoming",
    position: "single",
    avatar: 'logo192.png',
    sentTime: new Date().toISOString()
  }));

  async function pressSend(innerHtml : string, 
    textContent : string, 
    innerText : string, nodes : NodeList) {
    send(textContent);
  }
  async function send(msg : string) {
    if (!msg) {
      console.log("msg is empty");
      return;
    }
    appendMsg(msg, true);
    if (OPENKEY_REG.test(msg.trim())) {
      localStorage.setItem(OPENKEY_STORAGE_NAME, msg.trim());
      setOpenKey(msg.trim());
      appendMsg(`设置成功: ${msg.trim().substring(0, 10)}...\nkey只会在客户端使用,不会绕路到服务器,速度会大大提升. 你可以发送clear key清除设置`, false);
      return;
    } if (msg.trim() === "clear key") {
      localStorage.removeItem(OPENKEY_STORAGE_NAME);
      setOpenKey(null);
      appendMsg(`清除成功`, false);
      return;
    }
    

    try {
      setWaitingAI(true);
      let response = null;
      const aiArg = {
        model: "text-davinci-003",
        prompt: msg ,
        temperature: 0,
        max_tokens: 1024,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      };

      if (openKey) {
        response = await query(aiArg);
      } else {
        response = await API.post('openai', '/openai', {
          body: aiArg});
      }

      console.log("response: " + JSON.stringify(response));
      const resMsg = response.choices[0].text.replace(/^.*?\n\n/, '');
      appendMsg(resMsg, false);
    } catch (err) {
      console.error("error: " , err);
      if (navigator.onLine) {
        appendMsg(`当前用户太多, 请稍后再试.\n 
        或者直接回复openai的key, 避免共用一个后台端导致频繁失败\n
        错误: `+ err, false);
      } else {
        appendMsg("网络不可用!", false);
      }
    } finally {
      setWaitingAI(false);
    }
  }
  async function query(params : CreateCompletionRequest) {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br',
        'Authorization': 'Bearer ' + openKey
      },
      body: JSON.stringify(params)
    };
    const response = await fetch('https://api.openai.com/v1/completions', requestOptions);
    const data = await response.json();
    return data;
  }
  function appendMsg(msgText : string, isMe : boolean) {
    setMsgList((msgList : Array<AppMsg>) => [...msgList, buildMsg(msgText, isMe)]);
  }

  function buildMsg(msgText : string, isMe : boolean, msgType: MessageType = 'text' ) : AppMsg {
    return {
      message: msgText ,
      type: msgType,
      sentTime: new Date().toISOString(),
      direction: isMe ? "outgoing" : "incoming",
      position: "single",
      avatar: isMe ? 'img/avatar.png' : 'logo192.png',
    }
  }
  function buildHtmlMessage(msgText : string, isMe : boolean = false) : AppMsg {
    return buildMsg(msgText.replace(/\n/g, ''), isMe, 'html');
  }

  function showHelp() {
    const msg = buildHtmlMessage(`<div style="margin:0; font-size:0.7em">
    <h2 style="margin:0">Q&A</h2>
        <h3 style="margin:0">Q: AI经常发生错误</h3>
        <p style="margin:0">因为大家公用的一个key, 会被限流, 服务器繁忙. 如果想降低可以设置自己的key.
         如何获取key请自行百度:chatGPT账号.</p>
        <h3 style="margin:0">Q: 如何设置自己的key</h3>
        <p style="margin:0">直接在对话框回复key即可, key不会发送到代理服务器,请求都是在本地进行,输入"clear key"即可清除.</p>
        <h3 style="margin:0">Q: 有哪些功能</h3>
        <p style="margin:0">聊天</b>翻译成x文:写代码,文字生成图片</p>

        <div/>`, false);
    setMsgList((msgList : Array<AppMsg>) => [...msgList, msg]);
  }

  function buildMsgComponent(msg : AppMsg, k : number) : JSX.Element {
    return (<Message key={k} model={msg}> 
              <Avatar src={msg.avatar} />
            </Message> )
  }

  return (
    <div style={{ position:"relative", height: "100vh" }}>
    <MainContainer>
      <ChatContainer>    
        <ConversationHeader>
          <Avatar src="logo512.png" name="FAI" />
          <ConversationHeader.Content userName="FAI 人工智能合集"/>
          <ConversationHeader.Actions>  
            <InfoButton title="帮助" onClick={showHelp}/>
          </ConversationHeader.Actions>
        </ConversationHeader>

        <MessageList typingIndicator={ waitingAI ? <TypingIndicator content="AI正在输入" /> : null}>
            {msgList.map(buildMsgComponent)}
        </MessageList>

        <MessageInput attachButton={false} autoFocus onSend={pressSend}/>    

      </ChatContainer>
    </MainContainer>
  </div>
  )
}



//export default withAuthenticator(App);
export default App;