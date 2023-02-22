/* src/App.js */
import React, { useState } from 'react';
import { Amplify, API, I18n } from 'aws-amplify';
import {AmplifyUser} from '@aws-amplify/ui';
//import awsExports from "./aws-exports";
import {withAuthenticator, translations, WithAuthenticatorProps } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

import { MainContainer, ChatContainer, 
  Avatar, TypingIndicator, MessageModel,
  MessageList, Message, MessageInput, 
  ConversationHeader } from '@chatscope/chat-ui-kit-react';
 
// 设置语言
// I18n.putVocabularies(translations);
// I18n.setLanguage('ch');
// 设置amplify
//Amplify.configure(awsExports);

interface AppMsg extends MessageModel {
  avatar : string;
}

const App = (authProps : WithAuthenticatorProps) => {
  
  const [waitingAI, setWaitingAI] = useState(false);
  const [msgList, setMsgList] = useState(new Array(0));

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
    try {
      setWaitingAI(true);
      const response = await API.post('proxyai', '/proxyai', {
        body: {
          model: "text-davinci-003",
          prompt: msg ,
          temperature: 0,
          max_tokens: 2048,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
        }});
      console.log("response: " + JSON.stringify(response));
      const resMsg = response.choices[0].text.replace(/^.*?\n\n/, '');
      appendMsg(resMsg, false);
    } catch (err) {
      appendMsg("对不起, 系统出错了 请稍后再试.\n 错误: " + err, false);
    } finally {
      setWaitingAI(false);
    }
  }
  function appendMsg(msgText : string, isMe : boolean) {
    setMsgList((msgList : Array<AppMsg>) => [...msgList, buildMsg(msgText, isMe)]);
  }

  function buildMsg(msgText : string, isMe : boolean) : AppMsg {
    return {
      message: msgText,
      sentTime: new Date().toISOString(),
      direction: isMe ? "outgoing" : "incoming",
      position: "single",
      avatar: isMe ? 'img/avatar.png' : 'logo192.png',
    }
  }

  return (
    <div style={{ position:"relative", height: "100vh" }}>
    <MainContainer>
      <ChatContainer>    
        <ConversationHeader>
          <Avatar src="logo512.png" name="FAI" />
          <ConversationHeader.Content userName="FAI 人工智能集合"/>
        </ConversationHeader>

        <MessageList typingIndicator={ waitingAI ? <TypingIndicator content="AI正在输入" /> : null}>
            {msgList.map((m : AppMsg, i) => <Message key={i} model={m}> <Avatar src={m.avatar} /></Message> )}
        </MessageList>

        <MessageInput attachButton={false} autoFocus onSend={pressSend}/>    

      </ChatContainer>
    </MainContainer>
  </div>
  )
}



//export default withAuthenticator(App);
export default App;