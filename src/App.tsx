/* src/App.js */
import React, { useState } from 'react';
import { Amplify, API, I18n } from 'aws-amplify';
import { AmplifyUser } from '@aws-amplify/ui';
import awsExports from "./aws-exports";
import { withAuthenticator, translations, WithAuthenticatorProps } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { Configuration, OpenAIApi, CreateCompletionRequest } from 'openai'
import {
  MainContainer, ChatContainer, MessageType,
  Avatar, TypingIndicator, MessageModel, InfoButton,
  MessageList, Message, MessageInput,
  ConversationHeader, ArrowButton
} from '@chatscope/chat-ui-kit-react';

const OPENKEY_REG = /^sk-\w{48}$/;
const OPENKEY_STORAGE_NAME = "openaiKey";
// 设置语言
I18n.putVocabularies(translations);
I18n.setLanguage('zh');
// 设置amplify
Amplify.configure(awsExports);

interface AppMsg extends MessageModel {
  avatar: string;
}
interface AppPro extends WithAuthenticatorProps {
  installHandler? : () => Promise<void> | null
  showInstall? : boolean
}
const App = (appPro: AppPro) => {
  const HELP_MSG = buildHtmlMessage(`<div style="margin:0; font-size:1em">
<h2 style="margin:0">Q&A</h2>
    <h3 style="margin:0">Q: 有哪些功能?</h3>
    <p style="margin:0">
        1. 回答各种问题, 输入: <strong>如何找到金星在天空中的位置?</strong><br/>
        2. 文字生成图片, 输入: <strong><span style="color:red;">图片:</span> 一只飞翔的天鹅,飞在黄昏的天上</strong><br/>
        3. 文字生成语音(开发中), 输入: <strong><span style="color:red;">语音:</span> 注意看,这个男人名字叫小帅...</strong><br/>
    </p>
    <h3 style="margin:0">Q: 经常AI回复说:发生错误</h3>
    <p style="margin:0">    免费版会被限流, 服务器繁忙时会拒绝服务.</p>
    <h3 style="margin:0">Q: 如何设置私有key</h3>
    <p style="margin:0">    直接在对话框回复key即可, key<span style="color:red;">不会</span>发送到代理服务器,请求都是在本地进行,输入<span style="color:red;">clear key</span>即可清除.</p>
    </div>`, false);
  const [openKey, setOpenKey] = useState(localStorage.getItem(OPENKEY_STORAGE_NAME));
  const [waitingAI, setWaitingAI] = useState(false);
  const [msgList, setMsgList] = useState(new Array<AppMsg>(HELP_MSG));

  async function pressSend(innerHtml: string,
    textContent: string,
    innerText: string, nodes: NodeList) {
    send(textContent);
  }
  async function send(msg: string) {
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
      let resMsg = null;
      if (msg.startsWith("图片:") || msg.startsWith("img:")) {
        resMsg = await getImageAnswer(msg, openKey);
        appendMsg(resMsg, false, true);
      } else {
        resMsg = await getTextAnswer(msg, openKey);
        appendMsg(resMsg, false);
      }
    } catch (err) {
      console.error("error: ", err);
      if (navigator.onLine) {
        appendMsg(`当前用户太多, 请稍后再试.\n 
        或者直接回复私有的key, 避免共用一个后台端导致频繁失败\n
        错误: `+ err, false);
      } else {
        appendMsg("网络不可用!", false);
      }
    } finally {
      setWaitingAI(false);
    }
  }

  async function getImageAnswer(prompt: string, openKey: string | null) : Promise<string>{
    //   const configuration = new Configuration({
    //     apiKey: openKey?.toString(),
    // });

    // const openai = new OpenAIApi(configuration);
    // const resp = await openai.createImage({prompt, n : 1, size: "512x512", response_format : "url"})

    const aiArg = { prompt, n: 1, size: "512x512", response_format: "url" };
    if (!openKey) {
      const response = await API.post('openai', '/openai', {
        body: aiArg
      });
      return response.data[0].url;
    }
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br',
        'Authorization': 'Bearer ' + openKey
      },
      body: JSON.stringify(aiArg)
    };

    const response = await fetch('https://api.openai.com/v1/images/generations', requestOptions);
    const respBody = await response.json();
    console.log("respBody: " + JSON.stringify(respBody));
    return respBody.data[0].url;
  }
  
  async function query(params: CreateCompletionRequest) {
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

  async function getTextAnswer(msg: string, openKey: string | null) : Promise<string> {
    let response = null;
    const aiArg = {
      model: "text-davinci-003",
      prompt: msg,
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
        body: aiArg
      });
    }

    console.log("response: " + JSON.stringify(response));
    const resMsg = response.choices[0].text.replace(/^.*?\n\n/, '');
    return resMsg;
  }

  function appendMsg(msgText: string, isMe: boolean, isImage: boolean = false) {
    const msg = isImage ? buildImageMessage(msgText) : buildMsg(msgText, isMe);
    setMsgList((msgList: Array<AppMsg>) => [...msgList, msg]);
  }

  function buildMsg(msgText: string, isMe: boolean, msgType: MessageType = 'text'): AppMsg {
    return {
      message: msgText,
      type: msgType,
      sentTime: new Date().toISOString(),
      direction: isMe ? "outgoing" : "incoming",
      position: "single",
      avatar: isMe ? 'img/avatar.png' : 'logo192.png',
    }
  }
  function buildImageMessage(imageUrl: string): AppMsg {
    return buildMsg(imageUrl, false, 'image');
  }

  function buildHtmlMessage(msgText: string, isMe: boolean = false): AppMsg {
    return buildMsg(msgText.replace(/\n/g, ''), isMe, 'html');
  }

  function showHelp() {
    setMsgList((msgList: Array<AppMsg>) => [...msgList, HELP_MSG]);
  }

  function buildMsgComponent(msg: AppMsg, k: number): JSX.Element {
    return (<Message key={k} model={msg}>
      <Avatar src={msg.avatar} />
      {msg.type === 'image' ? <Message.ImageContent src={msg.message} width="100%" /> : null}
    </Message>)
  }

  function clickInstall() {
    if (appPro.installHandler) {
      appPro.installHandler()
    }
  }

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <MainContainer>
        <ChatContainer>
          <ConversationHeader>
            <Avatar src="logo512.png" name="FAI" />
            <ConversationHeader.Content userName="FAI 人工智能合集" />
            <ConversationHeader.Actions>
              { 
                appPro.showInstall ? <ArrowButton title="安装" direction='down' onClick={clickInstall}/> : undefined
              }
              <InfoButton title="帮助" onClick={showHelp} />
            </ConversationHeader.Actions>
          </ConversationHeader>

          <MessageList typingIndicator={waitingAI ? <TypingIndicator content="AI正在输入" /> : null}>
            {msgList.map(buildMsgComponent)}
          </MessageList>

          <MessageInput attachButton={false} autoFocus onSend={pressSend} />

        </ChatContainer>
      </MainContainer>
    </div>
  )
}



//export default withAuthenticator(App);
export default App;
