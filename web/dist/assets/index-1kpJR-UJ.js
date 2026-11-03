var e=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t,t.exports),e=null),t.exports);(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var t=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.LocalStorage=void 0,e.LocalStorage=class{async get(e){return typeof window>`u`?null:localStorage.getItem(e)}async set(e,t){typeof window<`u`&&localStorage.setItem(e,t)}async remove(e){typeof window<`u`&&localStorage.removeItem(e)}}})),n=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.encodeBase58=n;var t=`123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`;function n(e){if(e.length===0)return``;let n=0,r=0;for(;r<e.length&&e[r]===0;)n++,r++;let i=[0];for(;r<e.length;r++){let t=e[r];for(let e=0;e<i.length;++e)t+=i[e]<<8,i[e]=t%58,t=t/58|0;for(;t>0;)i.push(t%58),t=t/58|0}for(;i.length>0&&i[i.length-1]===0;)i.pop();let a=``;for(let e=0;e<n;e++)a+=t[0];for(let e=i.length-1;e>=0;--e)a+=t[i[e]];return a}})),r=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.nearActionsToConnectorActions=void 0;var t=n(),r=e=>{try{return JSON.parse(new TextDecoder().decode(e))}catch{return e}};e.nearActionsToConnectorActions=e=>e.map(e=>{if(`type`in e)return e;if(e.functionCall)return{type:`FunctionCall`,params:{methodName:e.functionCall.methodName,args:r(e.functionCall.args),gas:e.functionCall.gas.toString(),deposit:e.functionCall.deposit.toString()}};if(e.deployGlobalContract)return{type:`DeployGlobalContract`,params:{code:e.deployGlobalContract.code,deployMode:e.deployGlobalContract.deployMode.AccountId?`AccountId`:`CodeHash`}};if(e.createAccount)return{type:`CreateAccount`};if(e.useGlobalContract)return{type:`UseGlobalContract`,params:{contractIdentifier:e.useGlobalContract.contractIdentifier.AccountId?{accountId:e.useGlobalContract.contractIdentifier.AccountId}:{codeHash:(0,t.encodeBase58)(e.useGlobalContract.contractIdentifier.CodeHash)}}};if(e.deployContract)return{type:`DeployContract`,params:{code:e.deployContract.code}};if(e.deleteAccount)return{type:`DeleteAccount`,params:{beneficiaryId:e.deleteAccount.beneficiaryId}};if(e.deleteKey)return{type:`DeleteKey`,params:{publicKey:e.deleteKey.publicKey.toString()}};if(e.transfer)return{type:`Transfer`,params:{deposit:e.transfer.deposit.toString()}};if(e.stake)return{type:`Stake`,params:{stake:e.stake.stake.toString(),publicKey:e.stake.publicKey.toString()}};if(e.addKey)return{type:`AddKey`,params:{publicKey:e.addKey.publicKey.toString(),accessKey:{nonce:Number(e.addKey.accessKey.nonce),permission:e.addKey.accessKey.permission.functionCall?{receiverId:e.addKey.accessKey.permission.functionCall.receiverId,allowance:e.addKey.accessKey.permission.functionCall.allowance?.toString(),methodNames:e.addKey.accessKey.permission.functionCall.methodNames}:`FullAccess`}}};throw Error(`Unsupported action type`)})})),i=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.uuid4=void 0,e.uuid4=()=>typeof window<`u`&&window.crypto!==void 0&&typeof window.crypto.randomUUID==`function`?window.crypto.randomUUID():`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g,function(e){let t=Math.random()*16|0;return(e===`x`?t:t&3|8).toString(16)})})),a=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.ParentFrameWallet=void 0;var t=r(),n=i();e.ParentFrameWallet=class{connector;manifest;constructor(e,t){this.connector=e,this.manifest=t}callParentFrame(e,t){let r=(0,n.uuid4)();return window.parent.postMessage({type:`near-wallet-injected-request`,id:r,method:e,params:t},`*`),new Promise((e,t)=>{let n=i=>{i.data.type===`near-wallet-injected-response`&&i.data.id===r&&(window.removeEventListener(`message`,n),i.data.success?e(i.data.result):t(i.data.error))};window.addEventListener(`message`,n)})}async signIn(e){let t=await this.callParentFrame(`near:signIn`,{network:e?.network??this.connector.network,addFunctionCallKey:e?.addFunctionCallKey});return Array.isArray(t)?t:[t]}async signInAndSignMessage(e){let t=await this.callParentFrame(`near:signInAndSignMessage`,{network:e?.network??this.connector.network,addFunctionCallKey:e?.addFunctionCallKey,messageParams:e.messageParams});return Array.isArray(t)?t:[t]}async signOut(e){let t={...e,network:e?.network??this.connector.network};await this.callParentFrame(`near:signOut`,t)}async getAccounts(e){let t={...e,network:e?.network??this.connector.network};return this.callParentFrame(`near:getAccounts`,t)}async signAndSendTransaction(e){let n=(0,t.nearActionsToConnectorActions)(e.actions),r={...e,actions:n,network:e.network??this.connector.network};return this.callParentFrame(`near:signAndSendTransaction`,r)}async signAndSendTransactions(e){let n={...e,network:e.network??this.connector.network};return n.transactions=n.transactions.map(e=>({actions:(0,t.nearActionsToConnectorActions)(e.actions),receiverId:e.receiverId})),this.callParentFrame(`near:signAndSendTransactions`,n)}async signMessage(e){let t={...e,network:e.network??this.connector.network};return this.callParentFrame(`near:signMessage`,t)}async signDelegateActions(e){let n={...e,delegateActions:e.delegateActions.map(e=>({...e,actions:(0,t.nearActionsToConnectorActions)(e.actions)})),network:e.network||this.connector.network};return this.callParentFrame(`near:signDelegateActions`,n)}}})),o=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.parseUrl=void 0,e.parseUrl=e=>{try{return new URL(e)}catch{return null}}})),s=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.EventEmitter=void 0,e.EventEmitter=class{events={};on(e,t){this.events[e]||(this.events[e]=[]),this.events[e].push(t)}emit(e,t){this.events[e]?.forEach(e=>e(t))}off(e,t){this.events[e]=this.events[e]?.filter(e=>e!==t)}once(e,t){let n=r=>{t(r),this.off(e,n)};this.on(e,n)}removeAllListeners(e){e?delete this.events[e]:this.events={}}}})),c=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.escapeHtml=t,e.html=r;function t(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`)}var n=Symbol(`htmlTag`);function r(e,...r){let i=e[0];for(let a=0;a<r.length;a++){for(let e of Array.isArray(r[a])?r[a]:[r[a]]){let r=e?.[n]?e[n]:t(String(e??``));i+=r}i+=e[a+1]}return Object.freeze({[n]:i,get html(){return i}})}})),l=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.css=void 0,e.css=e=>`
${e} * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  -ms-overflow-style: none; 
  scrollbar-width: none; 
  color: #fff;
}

${e} *::-webkit-scrollbar { 
  display: none;
}

${e} p,
${e} h1,
${e} h2,
${e} h3,
${e} h4,
${e} h5,
${e} h6 {
  margin: 0;
}

${e} .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100000000;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    transition: opacity 0.2s ease-in-out;
}

@media (max-width: 600px) {
  ${e} .modal-container {
    justify-content: flex-end;
  }
}

${e} .modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;

  max-width: 420px;
  max-height: 615px;
  width: 100%;
  border-radius: 24px;
  background: #0d0d0d;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease-in-out;
}

@media (max-width: 600px) {
  ${e} .modal-content {
    max-width: 100%;
    width: 100%;
    max-height: 80%;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border: none;
    border-top: 1.5px solid rgba(255, 255, 255, 0.1);
  }
}


${e} .modal-header {
  display: flex;
  padding: 16px;
  gap: 16px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  position: relative;
}

${e} .modal-header button {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

${e} .modal-header button:hover {
  background: rgba(255, 255, 255, 0.04);
}
  
${e} .modal-header p {
  color: #fff;
  text-align: center;
  font-size: 24px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin: 0;
}


${e} .modal-body {
  display: flex;
  padding: 16px;
  flex-direction: column;
  align-items: flex-start;
  text-align: center;
  gap: 8px;
  overflow: auto;

  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  width: 100%;
  flex: 1;
}

${e} .modal-body textarea {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #0d0d0d;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  outline: none;
  font-size: 16px;
  transition: background 0.2s ease-in-out;
  font-family: monospace;
  font-size: 12px;
}

${e} .modal-body button {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  color: #000;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease-in-out;
  margin-top: 16px;
}

${e} .footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 24px;
  color: #fff;
  gap: 12px;
}

${e} .modal-body p {
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
  letter-spacing: -0.8px;
}

${e} .footer img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

${e} .get-wallet-link {
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  margin-left: auto;
  text-decoration: none;
  transition: color 0.2s ease-in-out;
  cursor: pointer;
}
  
${e} .get-wallet-link:hover {
  color: rgba(255, 255, 255, 1);
}


${e} .connect-item {
  display: flex;
  padding: 8px;
  align-items: center;
  gap: 12px;
  align-self: stretch;
  cursor: pointer;

  transition: background 0.2s ease-in-out;
  border-radius: 24px;
}

${e} .connect-item img {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  object-fit: cover;
  flex-shrink: 0;
}

${e} .connect-item-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  flex: 1;
  margin-top: -2px;
}

${e} .connect-item-info .wallet-address {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

${e} .connect-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

${e} .connect-item img {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  object-fit: cover;
}

${e} .connect-item p {
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  font-size: 18px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  letter-spacing: -0.36px;
  margin: 0;
}
`})),u=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.Popup=void 0;var t=l(),n=c(),r=`n${Math.random().toString(36).substring(2,15)}`;if(typeof document<`u`){let e=document.createElement(`style`);e.textContent=(0,t.css)(`.${r}`),document.head.append(e)}e.Popup=class{delegate;isClosed=!1;root=document.createElement(`div`);state={};constructor(e){this.delegate=e}get dom(){return(0,n.html)``}disposables=[];addListener(e,t,n){let r=typeof e==`string`?this.root.querySelector(e):e;r&&(r.addEventListener(t,n),this.disposables.push(()=>r.removeEventListener(t,n)))}handlers(){this.disposables.forEach(e=>e()),this.disposables=[];let e=this.root.querySelector(`.modal-container`),t=this.root.querySelector(`.modal-content`);t.onclick=e=>e.stopPropagation(),e.onclick=()=>{this.delegate.onReject(),this.destroy()}}update(e){this.state={...this.state,...e},this.root.innerHTML=this.dom.html,this.handlers()}create({show:e=!0}){this.root.className=`${r} hot-connector-popup`,this.root.innerHTML=this.dom.html,document.body.append(this.root),this.handlers();let t=this.root.querySelector(`.modal-container`),n=this.root.querySelector(`.modal-content`);n.style.transform=`translateY(50px)`,t.style.opacity=`0`,this.root.style.display=`none`,e&&setTimeout(()=>this.show(),10)}show(){let e=this.root.querySelector(`.modal-container`),t=this.root.querySelector(`.modal-content`);t.style.transform=`translateY(50px)`,e.style.opacity=`0`,this.root.style.display=`block`,setTimeout(()=>{t.style.transform=`translateY(0)`,e.style.opacity=`1`},100)}hide(){let e=this.root.querySelector(`.modal-container`),t=this.root.querySelector(`.modal-content`);t.style.transform=`translateY(50px)`,e.style.opacity=`0`,setTimeout(()=>{this.root.style.display=`none`},200)}destroy(){this.isClosed||(this.isClosed=!0,this.hide(),setTimeout(()=>{this.root.remove()},200))}}})),d=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.IframeWalletPopup=void 0;var t=c(),n=u();e.IframeWalletPopup=class extends n.Popup{delegate;constructor(e){super(e),this.delegate=e}handlers(){super.handlers(),this.addListener(`button`,`click`,()=>this.delegate.onApprove())}create(){super.create({show:!1}),this.root.querySelector(`.modal-body`).appendChild(this.delegate.iframe),this.delegate.iframe.style.width=`100%`,this.delegate.iframe.style.height=`720px`,this.delegate.iframe.style.border=`none`}get footer(){if(!this.delegate.footer)return``;let{icon:e,heading:n}=this.delegate.footer;return(0,t.html)`
      <div class="footer">
        ${e?(0,t.html)`<img src="${e}" alt="${n}" />`:``}
        <p>${n}</p>
      </div>
    `}get dom(){return(0,t.html)`<div class="modal-container">
      <div class="modal-content">
        <div class="modal-body" style="padding: 0; overflow: auto;"></div>
        ${this.footer}
      </div>
    </div>`}}})),f=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.NEAR_CONNECT_VERSION=void 0,e.NEAR_CONNECT_VERSION=`0.11.4`})),p=e((e=>{Object.defineProperty(e,"__esModule",{value:!0});var t=f();async function n(e){let n=await e.executor.getAllStorage(),r=e.executor.connector.providers,i=e.executor.manifest,a=e.id,o=e.code.replaceAll(`.localStorage`,`.sandboxedLocalStorage`).replaceAll(`window.top`,`window.selector`).replaceAll(`window.open`,`window.selector.open`),s=e.cspNonce?` nonce="${e.cspNonce.replace(/[^A-Za-z0-9+/=]/g,``)}"`:``;return`
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <div id="root"></div>

      <style>
        :root {
          --background-color: rgb(40, 40, 40);
          --text-color: rgb(255, 255, 255);
          --border-color: rgb(209, 209, 209);
        }

        * {
          font-family: system-ui, Avenir, Helvetica, Arial, sans-serif
        }

        body, html {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          background-color: var(--background-color);
          color: var(--text-color);
        }

        #root {
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          width: 100vw;
          background: radial-gradient(circle at center, #2c2c2c 0%, #1a1a1a 100%);
          text-align: center;
        }

        #root * {
          box-sizing: border-box;
          font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color-scheme: light dark;
          color: rgb(255, 255, 255);
          font-synthesis: none;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }

        .prompt-container img {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 12px;
        }

        .prompt-container h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          margin-top: 16px;
        }

        .prompt-container p {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          color: rgb(209, 209, 209);
        }

        .prompt-container button {
          background-color: #131313;
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          cursor: pointer;
          transition: border-color 0.25s;
          color: #fff;
          outline: none;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          margin-top: 16px;
        }
      </style>


      <script${s}>
      window.sandboxedLocalStorage = (() => {
        let storage = ${JSON.stringify(n)}

        return {
          setItem: function(key, value) {
            window.selector.storage.set(key, value)
            storage[key] = value || '';
          },
          getItem: function(key) {
            return key in storage ? storage[key] : null;
          },
          removeItem: function(key) {
            window.selector.storage.remove(key)
            delete storage[key];
          },
          get length() {
            return Object.keys(storage).length;
          },
          key: function(i) {
            const keys = Object.keys(storage);
            return keys[i] || null;
          },
        };
      })();

      const showPrompt = async (args) => {
        const root = document.getElementById("root");   
        root.style.display = "flex";
        root.innerHTML = \`
          <div class="prompt-container">
            <img src="${i.icon}" />
            <h1>${i.name}</h1>
            <p>\${args.title}</p>
            <button>\${args.button}</button>
          </div>
        \`;

        return new Promise((resolve) => {
          root.querySelector("button")?.addEventListener("click", () => {
            root.innerHTML = "";
            resolve(true);
          });
        });
      }

      class ProxyWindow {
        constructor(url, features) {
          this.closed = false;
          this.windowIdPromise = window.selector.call("open", { url, features });

          window.addEventListener("message", async (event) => {            
            if (event.data.origin !== "${a}") return;
            if (!event.data.method?.startsWith("proxy-window:")) return;
            const method = event.data.method.replace("proxy-window:", "");
            if (method === "closed" && event.data.windowId === await this.id()) this.closed = true;
          });
        } 

        async id() {
          return await this.windowIdPromise;
        }

        async focus() {
          await window.selector.call("panel.focus", { windowId: await this.id() });
        }

        async postMessage(data) {
          window.selector.call("panel.postMessage", { windowId: await this.id(), data });
        }

        async close() {
          await window.selector.call("panel.close", { windowId: await this.id() });
        }
      }

      window.selector = {
        wallet: null,
        location: "${window.location.href}",
        nearConnectVersion: "${t.NEAR_CONNECT_VERSION}",
        
        outerHeight: ${window.outerHeight},
        screenY: ${window.screenY},
        outerWidth: ${window.outerWidth},
        screenX: ${window.screenX},

        providers: {
          mainnet: ${JSON.stringify(r.mainnet)},
          testnet: ${JSON.stringify(r.testnet)},
        },

        uuid() {
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        },

        walletConnect: {
          connect(params) {
            return window.selector.call("walletConnect.connect", params);
          },
          disconnect(params) {
            return window.selector.call("walletConnect.disconnect", params);
          },
          request(params) {
            return window.selector.call("walletConnect.request", params);
          },
          getProjectId() {
            return window.selector.call("walletConnect.getProjectId", {});
          },
          getSession() {
            return window.selector.call("walletConnect.getSession", {});
          },
        },
      
        async ready(wallet) {
          wallet.manifest = ${JSON.stringify(i)};
          window.parent.postMessage({ method: "wallet-ready", origin: "${a}" }, "*");
          window.selector.wallet = wallet;
        },

        async call(method, params) {
          const id = window.selector.uuid();
          window.parent.postMessage({ method, params, id, origin: "${a}" }, "*");

          return new Promise((resolve, reject) => {
            const handler = (event) => {
              if (event.data.id !== id || event.data.origin !== "${a}") return;
              window.removeEventListener("message", handler);

              if (event.data.status === "failed") reject(event.data.result);
              else resolve(event.data.result);
            };

            window.addEventListener("message", handler);
          });
        },

        panelClosed(windowId) {
          window.parent.postMessage({ 
            method: "panel.closed", 
            origin: "${a}", 
            result: { windowId } 
          }, "*");
        },

        open(url, _, params) {
          return new ProxyWindow(url, params)
        },

        external(entity, key, ...args) {
          return window.selector.call("external", { entity, key, args: args || [] });
        },

        openNativeApp(url) {
          return window.selector.call("open.nativeApp", { url });
        },

        ui: {
          async whenApprove(options) {
            window.selector.ui.showIframe();
            await showPrompt(options);
            window.selector.ui.hideIframe();
          },

          async showIframe() {
            return await window.selector.call("ui.showIframe");
          },

          async hideIframe() {
            return await window.selector.call("ui.hideIframe");
          },
        },

        storage: {
          async set(key, value) {
            await window.selector.call("storage.set", { key, value });
          },
      
          async get(key) {
            return await window.selector.call("storage.get", { key });
          },
      
          async remove(key) {
            await window.selector.call("storage.remove", { key });
          },

          async keys() {
            return await window.selector.call("storage.keys", {});
          },
        },
      };

      window.addEventListener("message", async (event) => {
        if (event.data.origin !== "${a}") return;
        if (!event.data.method?.startsWith("wallet:")) return;
      
        const wallet = window.selector.wallet;
        const method = event.data.method.replace("wallet:", "");
        const payload = { id: event.data.id, origin: "${a}", method };
      
        if (wallet == null || typeof wallet[method] !== "function") {
          const data = { ...payload, status: "failed", result: "Method not found" };
          window.parent.postMessage(data, "*");
          return;
        }
        
        try {
          const result = await wallet[method](event.data.params);
          window.parent.postMessage({ ...payload, status: "success", result }, "*");
        } catch (error) {
          const data = { ...payload, status: "failed", result: error };
          window.parent.postMessage(data, "*");
        }
      });
      <\/script>

      <script type="module"${s}>${o}<\/script>
    </body>
  </html>
    `}e.default=n})),m=e(((e,t,n)=>{var r=n&&n.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0});var a=s(),o=i(),c=d(),l=r(p());e.default=class{executor;origin;iframe=document.createElement(`iframe`);events=new a.EventEmitter;popup;handler;readyPromiseResolve;readyPromise=new Promise(e=>{this.readyPromiseResolve=e});constructor(e,t,n,r){this.executor=e,this.origin=(0,o.uuid4)(),this.handler=e=>{e.data.origin===this.origin&&(e.data.method===`wallet-ready`&&this.readyPromiseResolve(),n(this,e))},window.addEventListener(`message`,this.handler);let i=[];this.executor.checkPermissions(`usb`)&&i.push(`usb *;`),this.executor.checkPermissions(`hid`)&&i.push(`hid *;`),this.executor.checkPermissions(`clipboardRead`)&&i.push(`clipboard-read;`),this.executor.checkPermissions(`clipboardWrite`)&&i.push(`clipboard-write;`),this.executor.checkPermissions(`bluetooth`)&&i.push(`bluetooth *;`),this.iframe.allow=i.join(` `),this.iframe.setAttribute(`sandbox`,`allow-scripts`),(0,l.default)({id:this.origin,executor:this.executor,code:t,cspNonce:r}).then(e=>{this.executor.connector.logger?.log(`Iframe code injected`),this.iframe.srcdoc=e}),this.popup=new c.IframeWalletPopup({footer:this.executor.connector.footerBranding,iframe:this.iframe,onApprove:()=>{},onReject:()=>{window.removeEventListener(`message`,this.handler),this.events.emit(`close`,{}),this.popup.destroy()}}),this.popup.create()}on(e,t){this.events.on(e,t)}show(){this.popup.show()}hide(){this.popup.hide()}postMessage(e){if(!this.iframe.contentWindow)throw Error(`Iframe not loaded`);this.iframe.contentWindow.postMessage({...e,origin:this.origin},`*`)}dispose(){window.removeEventListener(`message`,this.handler),this.popup.destroy()}}})),h=e(((e,t,n)=>{var r=n&&n.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0});var a=o(),s=i(),c=r(m()),l=(0,s.uuid4)();e.default=class{connector;manifest;activePanels={};storageSpace;constructor(e,t){this.connector=e,this.manifest=t,this.storageSpace=t.id}checkPermissions(e,t){if(e===`walletConnect`)return!!this.manifest.permissions.walletConnect;if(e===`external`){let e=this.manifest.permissions.external;return!e||!t?.entity?!1:e.includes(t.entity)}if(e===`allowsOpen`){let e=(0,a.parseUrl)(t?.url||``),n=this.manifest.permissions.allowsOpen;return!e||!n||!Array.isArray(n)||n.length===0?!1:n.some(t=>{let n=(0,a.parseUrl)(t);return!(!n||e.protocol!==n.protocol||n.hostname&&e.hostname!==n.hostname||n.pathname&&n.pathname!==`/`&&e.pathname!==n.pathname)})}return this.manifest.permissions[e]}assertPermissions(e,t,n){if(!this.checkPermissions(t,n.data.params))throw e.postMessage({...n.data,status:`failed`,result:`Permission denied`}),Error(`Permission denied`)}_onMessage=async(e,t)=>{let n=n=>{e.postMessage({...t.data,status:`success`,result:n})},r=n=>{e.postMessage({...t.data,status:`failed`,result:n})};if(t.data.method===`ui.showIframe`)e.show(),n(null);else if(t.data.method===`ui.hideIframe`)e.hide(),n(null);else if(t.data.method===`storage.set`)this.assertPermissions(e,`storage`,t),localStorage.setItem(`${this.storageSpace}:${t.data.params.key}`,t.data.params.value),n(null);else if(t.data.method===`storage.get`)this.assertPermissions(e,`storage`,t),n(localStorage.getItem(`${this.storageSpace}:${t.data.params.key}`));else if(t.data.method===`storage.keys`)this.assertPermissions(e,`storage`,t),n(Object.keys(localStorage).filter(e=>e.startsWith(`${this.storageSpace}:`)));else if(t.data.method===`storage.remove`)this.assertPermissions(e,`storage`,t),localStorage.removeItem(`${this.storageSpace}:${t.data.params.key}`),n(null);else if(t.data.method===`panel.focus`){let e=this.activePanels[t.data.params.windowId];e&&e.focus(),n(null)}else if(t.data.method===`panel.postMessage`){let e=this.activePanels[t.data.params.windowId];e&&e.postMessage(t.data.params.data,`*`),n(null)}else if(t.data.method===`panel.close`){let e=this.activePanels[t.data.params.windowId];e&&e.close(),delete this.activePanels[t.data.params.windowId],n(null)}else if(t.data.method===`walletConnect.connect`){this.assertPermissions(e,`walletConnect`,t);try{if(!this.connector.walletConnect)throw Error(`WalletConnect is not configured`);let e=await(await this.connector.walletConnect).connect(t.data.params);e.approval(),n({uri:e.uri})}catch(e){r(e)}}else if(t.data.method===`walletConnect.getProjectId`){if(!this.connector.walletConnect)throw Error(`WalletConnect is not configured`);this.assertPermissions(e,`walletConnect`,t),n((await this.connector.walletConnect).core.projectId)}else if(t.data.method===`walletConnect.disconnect`){this.assertPermissions(e,`walletConnect`,t);try{if(!this.connector.walletConnect)throw Error(`WalletConnect is not configured`);n(await(await this.connector.walletConnect).disconnect(t.data.params))}catch(e){r(e)}}else if(t.data.method===`walletConnect.getSession`){this.assertPermissions(e,`walletConnect`,t);try{if(!this.connector.walletConnect)throw Error(`WalletConnect is not configured`);let e=await this.connector.walletConnect,t=e.session.keys[e.session.keys.length-1],r=t?e.session.get(t):null;n(r?{topic:r.topic,namespaces:r.namespaces}:null)}catch(e){r(e)}}else if(t.data.method===`walletConnect.request`){this.assertPermissions(e,`walletConnect`,t);try{if(!this.connector.walletConnect)throw Error(`WalletConnect is not configured`);n(await(await this.connector.walletConnect).request(t.data.params))}catch(e){r(e)}}else if(t.data.method===`external`){this.assertPermissions(e,`external`,t);try{let{entity:e,key:r,args:i}=t.data.params,a=e.split(`.`).reduce((e,t)=>e[t],window);e===`nightly.near`&&r===`signTransaction`&&(i[0].encode=()=>i[0]),n(typeof a[r]==`function`?await a[r](...i||[]):a[r])}catch(e){r(e)}}else if(t.data.method===`open`){this.assertPermissions(e,`allowsOpen`,t);let r=typeof window<`u`?window?.Telegram?.WebApp:null;if(r&&t.data.params.url.startsWith(`https://t.me`)){r.openTelegramLink(t.data.params.url);return}let i=window.open(t.data.params.url,`_blank`,t.data.params.features),o=i?(0,s.uuid4)():null,c=n=>{let r=(0,a.parseUrl)(t.data.params.url);r&&r.origin===n.origin&&e.postMessage(n.data)};if(n(o),window.addEventListener(`message`,c),i&&o){this.activePanels[o]=i;let t=setInterval(()=>{if(!i?.closed)return;window.removeEventListener(`message`,c);let n={method:`proxy-window:closed`,windowId:o};delete this.activePanels[o],clearInterval(t);try{e.postMessage(n)}catch{}},500)}}else if(t.data.method===`open.nativeApp`){this.assertPermissions(e,`allowsOpen`,t);let n=(0,a.parseUrl)(t.data.params.url);if(!n||[`https`,`http`,`javascript:`,`file:`,`data:`,`blob:`,`about:`].includes(n.protocol))throw r(`Invalid URL`),Error(`[open.nativeApp] Invalid URL`);let i=document.createElement(`iframe`);i.src=t.data.params.url,i.style.display=`none`,document.body.appendChild(i),e.postMessage({...t.data,status:`success`,result:null})}};actualCode=null;async checkNewVersion(e,t){if(this.actualCode)return this.connector.logger?.log(`New version of code already checked`),this.actualCode;let n=(0,a.parseUrl)(e.manifest.executor);if(n||=(0,a.parseUrl)(location.origin+e.manifest.executor),!n)throw Error(`Invalid executor URL`);n.searchParams.set(`nonce`,l);let r=await fetch(n.toString()).then(e=>e.text());return this.connector.logger?.log(`New version of code fetched`),this.actualCode=r,r===t?(this.connector.logger?.log(`New version of code is the same as the current version`),this.actualCode):(await this.connector.db.setItem(`${this.manifest.id}:${this.manifest.version}`,r),this.connector.logger?.log(`New version of code saved to cache`),r)}async loadCode(){let e=await this.connector.db.getItem(`${this.manifest.id}:${this.manifest.version}`).catch(()=>null);this.connector.logger?.log(`Code loaded from cache`,e!==null);let t=this.checkNewVersion(this,e);return e||await t}async call(e,t){this.connector.logger?.log(`Add to queue`,e,t),this.connector.logger?.log(`Calling method`,e,t);let n=await this.loadCode();this.connector.logger?.log(`Code loaded, preparing`);let r=new c.default(this,n,this._onMessage,this.connector.cspNonce);this.connector.logger?.log(`Code loaded, iframe initialized`),await r.readyPromise,this.connector.logger?.log(`Iframe ready`);let i=(0,s.uuid4)();return new Promise((n,a)=>{try{let o=s=>{s.data.id===i&&s.data.origin===r.origin&&(r.dispose(),window.removeEventListener(`message`,o),this.connector.logger?.log(`postMessage`,{result:s.data,request:{method:e,params:t}}),s.data.status===`failed`?a(s.data.result):n(s.data.result))};window.addEventListener(`message`,o),r.postMessage({method:e,params:t,id:i}),r.on(`close`,()=>a(Error(`Wallet closed`)))}catch(e){this.connector.logger?.log(`Iframe error`,e),a(e)}})}async getAllStorage(){let e=Object.keys(localStorage).filter(e=>e.startsWith(`${this.storageSpace}:`)),t={};for(let n of e)t[n.replace(`${this.storageSpace}:`,``)]=localStorage.getItem(n);return t}async clearStorage(){let e=Object.keys(localStorage).filter(e=>e.startsWith(`${this.storageSpace}:`));for(let t of e)localStorage.removeItem(t)}}})),g=e(((e,t,n)=>{var i=n&&n.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.SandboxWallet=void 0;var a=r(),o=i(h()),s=class{connector;manifest;executor;constructor(e,t){this.connector=e,this.manifest=t,this.executor=new o.default(e,t)}async signIn(e){return this.executor.call(`wallet:signIn`,{network:e?.network??this.connector.network,addFunctionCallKey:e?.addFunctionCallKey})}async signInAndSignMessage(e){return this.executor.call(`wallet:signInAndSignMessage`,{network:e?.network??this.connector.network,addFunctionCallKey:e?.addFunctionCallKey,messageParams:e.messageParams})}async signOut(e){let t={...e,network:e?.network??this.connector.network};await this.executor.call(`wallet:signOut`,t),await this.executor.clearStorage()}async getAccounts(e){let t={...e,network:e?.network??this.connector.network};return this.executor.call(`wallet:getAccounts`,t)}async signAndSendTransaction(e){let t=(0,a.nearActionsToConnectorActions)(e.actions),n={...e,actions:t,network:e.network??this.connector.network};return this.executor.call(`wallet:signAndSendTransaction`,n)}async signAndSendTransactions(e){let t=e.transactions.map(e=>({actions:(0,a.nearActionsToConnectorActions)(e.actions),receiverId:e.receiverId})),n={...e,transactions:t,network:e.network??this.connector.network};return this.executor.call(`wallet:signAndSendTransactions`,n)}async signMessage(e){let t={...e,network:e.network??this.connector.network};return this.executor.call(`wallet:signMessage`,t)}async signDelegateActions(e){let t={...e,delegateActions:e.delegateActions.map(e=>({...e,actions:(0,a.nearActionsToConnectorActions)(e.actions)})),network:e.network??this.connector.network};return this.executor.call(`wallet:signDelegateActions`,t)}};e.SandboxWallet=s,e.default=s})),_=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.InjectedWallet=void 0;var t=r();e.InjectedWallet=class{connector;wallet;constructor(e,t){this.connector=e,this.wallet=t}get manifest(){return this.wallet.manifest}async signIn({addFunctionCallKey:e,network:t}){return this.wallet.signIn({network:t??this.connector.network,addFunctionCallKey:e})}async signInAndSignMessage(e){return this.wallet.signInAndSignMessage({network:e?.network??this.connector.network,addFunctionCallKey:e.addFunctionCallKey,messageParams:e.messageParams})}async signOut(e){await this.wallet.signOut({network:e?.network??this.connector.network})}async getAccounts(e){return this.wallet.getAccounts({network:e?.network??this.connector.network})}async signAndSendTransaction(e){let n=(0,t.nearActionsToConnectorActions)(e.actions),r=e.network??this.connector.network,i=await this.wallet.signAndSendTransaction({...e,actions:n,network:r});if(!i)throw Error(`No result from wallet`);return Array.isArray(i.transactions)?i.transactions[0]:i}async signAndSendTransactions(e){let n=e.network??this.connector.network,r=e.transactions.map(e=>({actions:(0,t.nearActionsToConnectorActions)(e.actions),receiverId:e.receiverId})),i=await this.wallet.signAndSendTransactions({...e,transactions:r,network:n});if(!i)throw Error(`No result from wallet`);return Array.isArray(i.transactions)?i.transactions:i}async signMessage(e){return this.wallet.signMessage({...e,network:e.network??this.connector.network})}async signDelegateActions(e){return this.wallet.signDelegateActions({...e,delegateActions:e.delegateActions.map(e=>({...e,actions:(0,t.nearActionsToConnectorActions)(e.actions)})),network:e.network??this.connector.network})}}})),v=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.NearWalletsPopup=void 0;var t=c(),n=o(),r=u(),i={id:`custom-wallet`,name:`Custom Wallet`,icon:`https://www.mynearwallet.com/images/webclip.png`,description:`Custom wallet for NEAR.`,website:``,version:`1.0.0`,executor:`your-executor-url.js`,type:`sandbox`,platform:{},features:{signMessage:!0,signInWithoutAddKey:!0,signInAndSignMessage:!0,signAndSendTransaction:!0,signAndSendTransactions:!0,signDelegateActions:!0},permissions:{storage:!0,allowsOpen:[]}};e.NearWalletsPopup=class extends r.Popup{delegate;constructor(e){super(e),this.delegate=e,this.update({wallets:e.wallets,showSettings:!1})}handlers(){super.handlers(),this.addListener(`.settings-button`,`click`,()=>this.update({showSettings:!0})),this.addListener(`.back-button`,`click`,()=>this.update({showSettings:!1})),this.root.querySelectorAll(`.connect-item`).forEach(e=>{e instanceof HTMLDivElement&&this.addListener(e,`click`,()=>this.delegate.onSelect(e.dataset.type))}),this.root.querySelectorAll(`.remove-wallet-button`).forEach(e=>{e instanceof SVGSVGElement&&this.addListener(e,`click`,async t=>{t.stopPropagation(),await this.delegate.onRemoveDebugManifest(e.dataset.type);let n=this.state.wallets.filter(t=>t.id!==e.dataset.type);this.update({wallets:n})})}),this.addListener(`.add-debug-manifest-button`,`click`,async()=>{try{let e=this.root.querySelector(`#debug-manifest-input`)?.value??``,t=await this.delegate.onAddDebugManifest(e);this.update({showSettings:!1,wallets:[t,...this.state.wallets]})}catch(e){alert(`Something went wrong: ${e}`)}})}create(){super.create({show:!0})}walletDom(e){let r=(0,t.html)`
      <svg
        class="remove-wallet-button"
        data-type="${e.id}"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style="margin-right: 4px;"
      >
        <path d="M18 6L6 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6 6L18 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;return(0,t.html)`
      <div class="connect-item" data-type="${e.id}">
        <img style="background: #333" src="${e.icon}" alt="${e.name}" />
        <div class="connect-item-info">
          <span>${e.name}</span>
          <span class="wallet-address">${(0,n.parseUrl)(e.website)?.hostname}</span>
        </div>
        ${e.debug?r:``}
      </div>
    `}get footer(){if(!this.delegate.footer)return``;let{icon:e,heading:n,link:r,linkText:i}=this.delegate.footer;return(0,t.html)`
      <div class="footer">
        ${e?(0,t.html)`<img src="${e}" alt="${n}" />`:``}
        <p>${n}</p>
        <a class="get-wallet-link" href="${r}" target="_blank">${i}</a>
      </div>
    `}get dom(){return this.state.showSettings?(0,t.html)`
        <div class="modal-container">
          <div class="modal-content">
            <div class="modal-header">
              <button class="back-button" style="left: 16px; right: unset;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <p>Settings</p>
            </div>

            <div class="modal-body">
              <p style="text-align: left;">
                You can add your wallet to dapp for debug,
                <a href="https://github.com/azbang/hot-connector" target="_blank">read the documentation.</a> Paste your manifest and click "Add".
              </p>

              <textarea style="width: 100%;" id="debug-manifest-input" rows="10">${JSON.stringify(i,null,2)}</textarea>
              <button class="add-debug-manifest-button">Add</button>
            </div>

            ${this.footer}
          </div>
        </div>
      `:(0,t.html)`<div class="modal-container">
      <div class="modal-content">
        <div class="modal-header">
          <p>Select wallet</p>
          <button class="settings-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="19" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="5" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
            </svg>
          </button>
        </div>

        <div class="modal-body">${this.state.wallets.map(e=>this.walletDom(e))}</div>

        ${this.footer}
      </div>
    </div>`}}})),ee=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.default=class{dbName;storeName;version;constructor(e,t){this.dbName=e,this.storeName=t,this.version=1}getDb(){return new Promise((e,t)=>{if(typeof window>`u`||typeof indexedDB>`u`){t(Error(`IndexedDB is not available (SSR environment)`));return}let n=indexedDB.open(this.dbName,this.version);n.onerror=e=>{console.error(`Error opening database:`,e.target.error),t(Error(`Error opening database`))},n.onsuccess=t=>{e(n.result)},n.onupgradeneeded=e=>{let t=n.result;t.objectStoreNames.contains(this.storeName)||t.createObjectStore(this.storeName)}})}async getItem(e){let t=await this.getDb();if(typeof e==`number`&&(e=e.toString()),typeof e!=`string`)throw Error(`Key must be a string`);return new Promise((n,r)=>{if(!this.storeName){r(Error(`Store name not set`));return}let i=t.transaction(this.storeName,`readonly`);i.onerror=e=>r(i.error);let a=i.objectStore(this.storeName).get(e);a.onerror=e=>r(a.error),a.onsuccess=()=>{n(a.result),t.close()}})}async setItem(e,t){let n=await this.getDb();if(typeof e==`number`&&(e=e.toString()),typeof e!=`string`)throw Error(`Key must be a string`);return new Promise((r,i)=>{if(!this.storeName){i(Error(`Store name not set`));return}let a=n.transaction(this.storeName,`readwrite`);a.onerror=e=>i(a.error);let o=a.objectStore(this.storeName).put(t,e);o.onerror=e=>i(o.error),o.onsuccess=()=>{n.close(),r()}})}async removeItem(e){let t=await this.getDb();if(typeof e==`number`&&(e=e.toString()),typeof e!=`string`)throw Error(`Key must be a string`);return new Promise((n,r)=>{if(!this.storeName){r(Error(`Store name not set`));return}let i=t.transaction(this.storeName,`readwrite`);i.onerror=e=>r(i.error);let a=i.objectStore(this.storeName).delete(e);a.onerror=e=>r(a.error),a.onsuccess=()=>{t.close(),n()}})}async keys(){let e=await this.getDb();return new Promise((t,n)=>{if(!this.storeName){n(Error(`Store name not set`));return}let r=e.transaction(this.storeName,`readonly`);r.onerror=e=>n(r.error);let i=r.objectStore(this.storeName).getAllKeys();i.onerror=e=>n(i.error),i.onsuccess=()=>{t(i.result),e.close()}})}async count(){let e=await this.getDb();return new Promise((t,n)=>{if(!this.storeName){n(Error(`Store name not set`));return}let r=e.transaction(this.storeName,`readonly`);r.onerror=e=>n(r.error);let i=r.objectStore(this.storeName).count();i.onerror=e=>n(i.error),i.onsuccess=()=>{t(i.result),e.close()}})}async length(){return this.count()}async clear(){let e=await this.getDb();return new Promise((t,n)=>{if(!this.storeName){n(Error(`Store name not set`));return}let r=e.transaction(this.storeName,`readwrite`);r.onerror=e=>n(r.error);let i=r.objectStore(this.storeName).clear();i.onerror=e=>n(i.error),i.onsuccess=()=>{e.close(),t()}})}}})),y=e(((e,n,r)=>{var i=r&&r.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.NearConnector=void 0;var o=s(),c=v(),l=t(),u=i(ee()),d=a(),f=_(),p=g(),m=[`https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json`,`https://cdn.jsdelivr.net/gh/azbang/hot-connector/repository/manifest.json`];function h(e){return t=>Object.entries(e).length===0||Object.entries(e).filter(([e,t])=>t===!0).every(([e])=>t.manifest.features?.[e]===!0)}e.NearConnector=class{storage;events;db;logger;wallets=[];manifest={wallets:[],version:`1.0.0`};features={};network=`mainnet`;providers={mainnet:[],testnet:[]};walletConnect;footerBranding;excludedWallets=[];autoConnect;cspNonce;whenManifestLoaded;constructor(e){this.db=new u.default(`hot-connector`,`wallets`),this.storage=e?.storage??new l.LocalStorage,this.events=e?.events??new o.EventEmitter,this.logger=e?.logger,this.cspNonce=e?.cspNonce,this.network=e?.network??`mainnet`,this.walletConnect=e?.walletConnect,this.autoConnect=e?.autoConnect??!0,this.providers=e?.providers??{mainnet:[],testnet:[]},this.excludedWallets=e?.excludedWallets??[],this.features=e?.features??{},this.footerBranding=e?.footerBranding===void 0?{icon:`data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%20512%20512%22%20class%3D%22size-7%22%3E%3Crect%20width%3D%22512%22%20height%3D%22512%22%20fill%3D%22%2300ec97%22%20rx%3D%22110%22%2F%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M373.89%20106.199a31.95%2031.95%200%200%200-27.213%2015.207l-62.631%2092.979a6.67%206.67%200%200%200-.989%205.001%206.66%206.66%200%200%200%202.837%204.235%206.67%206.67%200%200%200%208.032-.494l61.643-53.47c1.02-.924%202.599-.827%203.523.193.419.473.644%201.074.644%201.697v167.402a2.49%202.49%200%200%201-2.502%202.491%202.48%202.48%200%200%201-1.912-.891L168.976%20117.497a31.93%2031.93%200%200%200-24.356-11.298h-6.508c-17.623%200-31.917%2014.294-31.917%2031.917v235.767c0%2017.623%2014.294%2031.917%2031.917%2031.917a31.94%2031.94%200%200%200%2027.213-15.206l62.631-92.98a6.66%206.66%200%200%200-1.847-9.236%206.67%206.67%200%200%200-8.033.494l-61.643%2053.471c-1.02.923-2.599.826-3.522-.194a2.5%202.5%200%200%201-.634-1.697V173.008a2.49%202.49%200%200%201%202.502-2.492c.731%200%201.439.322%201.912.891l186.313%20223.096a31.95%2031.95%200%200%200%2024.357%2011.297h6.508c17.623%200%2031.927-14.272%2031.938-31.895V138.116c0-17.623-14.294-31.917-31.917-31.917%22%2F%3E%3C%2Fsvg%3E`,heading:`NEAR Connector`,link:`https://wallet.near.org`,linkText:`Don't have a wallet?`}:e?.footerBranding,this.whenManifestLoaded=new Promise(async t=>{this.manifest=e?.manifest==null||typeof e.manifest==`string`?await this._loadManifest(e?.manifest).catch(()=>({wallets:[],version:`1.0.0`})):e?.manifest??{wallets:[],version:`1.0.0`};let n=new Set(this.excludedWallets);n.delete(`hot-wallet`),this.manifest.wallets=this.manifest.wallets.filter(e=>!(e.permissions.walletConnect&&!this.walletConnect||n.has(e.id))),await new Promise(e=>setTimeout(e,100)),t()}),typeof window<`u`&&(window.addEventListener(`near-wallet-injected`,this._handleNearWalletInjected),window.dispatchEvent(new Event(`near-selector-ready`)),window.addEventListener(`message`,async e=>{e.data.type===`near-wallet-injected`&&(await this.whenManifestLoaded.catch(()=>{}),this.wallets=this.wallets.filter(t=>t.manifest.id!==e.data.manifest.id),this.wallets.unshift(new d.ParentFrameWallet(this,e.data.manifest)),this.events.emit(`selector:walletsChanged`,{}),this.autoConnect&&this.connect({walletId:e.data.manifest.id}))})),this.whenManifestLoaded.then(()=>{typeof window<`u`&&window.parent.postMessage({type:`near-selector-ready`},`*`),this.manifest.wallets.forEach(e=>this.registerWallet(e)),this.storage.get(`debug-wallets`).then(e=>{JSON.parse(e??`[]`).forEach(e=>this.registerDebugWallet(e))})})}get availableWallets(){return this.wallets.filter(e=>Object.entries(this.features).every(([t,n])=>!(n&&!e.manifest.features?.[t]))).filter(e=>!(this.network===`testnet`&&!e.manifest.features?.testnet))}_handleNearWalletInjected=e=>{this.wallets=this.wallets.filter(t=>t.manifest.id!==e.detail.manifest.id),this.wallets.unshift(new f.InjectedWallet(this,e.detail)),this.events.emit(`selector:walletsChanged`,{})};async _loadManifest(e){let t=e?[e]:m;for(let e of t){let t=await fetch(e).catch(()=>null);if(t&&t.ok)return await t.json()}throw Error(`Failed to load manifest`)}async switchNetwork(e,t){this.network!==e&&(await this.disconnect().catch(()=>{}),this.network=e,await this.connect(t))}async registerWallet(e){if(e.type!==`sandbox`)throw Error(`Only sandbox wallets are supported`);this.wallets.find(t=>t.manifest.id===e.id)||(this.wallets.push(new p.SandboxWallet(this,e)),this.events.emit(`selector:walletsChanged`,{}))}async registerDebugWallet(e){let t=typeof e==`string`?JSON.parse(e):e;if(t.type!==`sandbox`)throw Error(`Only sandbox wallets type are supported`);if(!t.id)throw Error(`Manifest must have an id`);if(!t.name)throw Error(`Manifest must have a name`);if(!t.icon)throw Error(`Manifest must have an icon`);if(!t.website)throw Error(`Manifest must have a website`);if(!t.version)throw Error(`Manifest must have a version`);if(!t.executor)throw Error(`Manifest must have an executor`);if(!t.features)throw Error(`Manifest must have features`);if(!t.permissions)throw Error(`Manifest must have permissions`);if(this.wallets.find(e=>e.manifest.id===t.id))throw Error(`Wallet already registered`);t.debug=!0,this.wallets.unshift(new p.SandboxWallet(this,t)),this.events.emit(`selector:walletsChanged`,{});let n=this.wallets.filter(e=>e.manifest.debug).map(e=>e.manifest);return this.storage.set(`debug-wallets`,JSON.stringify(n)),t}async removeDebugWallet(e){this.wallets=this.wallets.filter(t=>t.manifest.id!==e);let t=this.wallets.filter(e=>e.manifest.debug).map(e=>e.manifest);this.storage.set(`debug-wallets`,JSON.stringify(t)),this.events.emit(`selector:walletsChanged`,{})}async selectWallet({features:e={}}={}){return await this.whenManifestLoaded.catch(()=>{}),new Promise((t,n)=>{let r=new c.NearWalletsPopup({footer:this.footerBranding,wallets:this.availableWallets.filter(h(e)).map(e=>e.manifest),onRemoveDebugManifest:async e=>this.removeDebugWallet(e),onAddDebugManifest:async e=>this.registerDebugWallet(e),onReject:()=>(n(Error(`User rejected`)),r.destroy()),onSelect:e=>(t(e),r.destroy())});r.create()})}async connect(e={}){let t=e.walletId,n=e.signMessageParams;await this.whenManifestLoaded.catch(()=>{}),t||=await this.selectWallet({features:{signInAndSignMessage:e.signMessageParams!=null||void 0,signInWithFunctionCallKey:e.addFunctionCallKey!=null||void 0}});try{let r=await this.wallet(t);this.logger?.log(`Wallet available to connect`,r),await this.storage.set(`selected-wallet`,t),this.logger?.log(`Set preferred wallet, try to signIn${n==null?``:` (with signed message)`}`,t);let i;if(e.addFunctionCallKey!=null&&(this.logger?.log(`Adding function call access key during sign in with params`,e.addFunctionCallKey),i={...e.addFunctionCallKey,gasAllowance:e.addFunctionCallKey.gasAllowance??{amount:`250000000000000000000000`,kind:`limited`}}),n!=null){let e=await r.signInAndSignMessage({addFunctionCallKey:i,messageParams:n,network:this.network});if(!e?.length)throw Error(`Failed to sign in`);this.logger?.log(`Signed in to wallet (with signed message)`,t,e),this.events.emit(`wallet:signInAndSignMessage`,{wallet:r,accounts:e,success:!0}),this.events.emit(`wallet:signIn`,{wallet:r,accounts:e.map(e=>({accountId:e.accountId,publicKey:e.publicKey})),success:!0,source:`signInAndSignMessage`})}else{let e=await r.signIn({addFunctionCallKey:i,network:this.network});if(!e?.length)throw Error(`Failed to sign in`);this.logger?.log(`Signed in to wallet`,t,e),this.events.emit(`wallet:signIn`,{wallet:r,accounts:e,success:!0,source:`signIn`})}return r}catch(e){throw this.logger?.log(`Failed to connect to wallet`,e),e}}async disconnect(e){e||=await this.wallet(),await e.signOut({network:this.network}),await this.storage.remove(`selected-wallet`),this.events.emit(`wallet:signOut`,{success:!0})}async getConnectedWallet(){await this.whenManifestLoaded.catch(()=>{});let e=await this.storage.get(`selected-wallet`),t=this.wallets.find(t=>t.manifest.id===e);if(!t)throw Error(`No wallet selected`);let n=await t.getAccounts();if(!n?.length)throw Error(`No accounts found`);return{wallet:t,accounts:n}}async wallet(e){if(await this.whenManifestLoaded.catch(()=>{}),!e)return this.getConnectedWallet().then(({wallet:e})=>e).catch(async()=>{throw await this.storage.remove(`selected-wallet`),Error(`No accounts found`)});let t=this.wallets.find(t=>t.manifest.id===e);if(!t)throw Error(`Wallet not found`);return t}async use(e){await this.whenManifestLoaded.catch(()=>{}),this.wallets=this.wallets.map(t=>new Proxy(t,{get(t,n,r){let i=Reflect.get(t,n,r);if(n in e&&typeof i==`function`){let r=e[n];return function(...e){let n=()=>i.apply(t,e);return e.length>0?r.call(this,...e,n):r.call(this,void 0,n)}}return i}}))}on(e,t){this.events.on(e,t)}once(e,t){this.events.once(e,t)}off(e,t){this.events.off(e,t)}removeAllListeners(e){this.events.removeAllListeners(e)}}})),b=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.nearActionsToConnectorActions=e.NearConnector=e.InjectedWallet=e.SandboxWallet=e.ParentFrameWallet=e.LocalStorage=void 0;var n=t();Object.defineProperty(e,"LocalStorage",{enumerable:!0,get:function(){return n.LocalStorage}});var i=a();Object.defineProperty(e,"ParentFrameWallet",{enumerable:!0,get:function(){return i.ParentFrameWallet}});var o=g();Object.defineProperty(e,"SandboxWallet",{enumerable:!0,get:function(){return o.SandboxWallet}});var s=_();Object.defineProperty(e,"InjectedWallet",{enumerable:!0,get:function(){return s.InjectedWallet}});var c=y();Object.defineProperty(e,"NearConnector",{enumerable:!0,get:function(){return c.NearConnector}});var l=r();Object.defineProperty(e,"nearActionsToConnectorActions",{enumerable:!0,get:function(){return l.nearActionsToConnectorActions}})}))(),x=`rp.relpass-emilh.testnet`,S=[`https://rpc.testnet.near.org`,`https://test.rpc.fastnear.com`],C=`https://testnet.nearblocks.io`,w=1000000000000n,T=10n**24n,E=document.getElementById(`app`);document.getElementById(`contract-id`).textContent=x;var D=e=>String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),O=e=>/^https?:\/\//i.test(e||``)?D(e):`#`,k=e=>{if(e==null)return`-`;let t=BigInt(e);return`${t/T}.${(t%T*10000n/T).toString().padStart(4,`0`)}`.replace(/\.?0+$/,``)||`0`},A=e=>{let[t,n=``]=String(e).trim().split(`.`);return(BigInt(t||`0`)*T+BigInt((n+`0`.repeat(24)).slice(0,24))).toString()},j=e=>e?new Date(Number(BigInt(e)/1000000n)).toISOString().replace(`T`,` `).slice(0,19)+` UTC`:`-`,M=e=>e?`<a class="mono" href="${C}/address/${D(e)}" target="_blank" rel="noopener">${D(e)}</a>`:`-`,N=e=>typeof e==`string`?e:Object.keys(e||{})[0]||`-`,P=e=>({Active:`OK`,Revoked:`REVOKED`,Compromised:`COMPROMISED`})[N(e)]||`UNKNOWN`,F=e=>`<span class="tag v-${D(e)}">${D(e)}</span>`;async function I(e,t){let n;for(let r of S)try{let n=await(await fetch(r,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({jsonrpc:`2.0`,id:`rp`,method:e,params:t})})).json();if(n.error)throw Error(n.error.data||n.error.message||JSON.stringify(n.error));return n.result}catch(e){n=e}throw n}async function L(e,t={},n=x){let r=await I(`query`,{request_type:`call_function`,finality:`optimistic`,account_id:n,method_name:e,args_base64:btoa(JSON.stringify(t))}),i=new TextDecoder().decode(new Uint8Array(r.result));return i?JSON.parse(i):null}var R=e=>I(`query`,{request_type:`view_account`,finality:`final`,account_id:e}),z=e=>I(`query`,{request_type:`view_access_key_list`,finality:`final`,account_id:e});async function B(e){let t=await crypto.subtle.digest(`SHA-256`,await e.arrayBuffer());return[...new Uint8Array(t)].map(e=>e.toString(16).padStart(2,`0`)).join(``)}var V=new b.NearConnector({network:`testnet`}),H=null,U=document.getElementById(`wallet`);function W(e){H=e,U.textContent=e?`${e} · sign out`:`Connect wallet`}V.on(`wallet:signIn`,e=>{W(e.accounts?.[0]?.accountId||null),$()}),V.on(`wallet:signOut`,()=>{W(null),$()}),(async()=>{try{let e=await(await V.wallet()).getAccounts();e?.length&&W(e[0].accountId),$()}catch{}})(),U.addEventListener(`click`,async()=>{try{H?(await(await V.wallet()).signOut(),W(null),$()):await V.connect()}catch(e){alert(`Wallet: ${e.message||e}`)}});async function G(e,t,n=`0`,r=100n){if(!H)throw Error(`Connect a testnet wallet first.`);return(await V.wallet()).signAndSendTransaction({receiverId:x,actions:[{type:`FunctionCall`,params:{methodName:e,args:t,gas:(r*w).toString(),deposit:n}}]})}async function K(e,t){let n=e.textContent;e.disabled=!0,e.textContent=`Waiting for wallet...`;try{await t(),e.textContent=`Done`,setTimeout($,1500)}catch(t){e.disabled=!1,e.textContent=n,alert(t.message||String(t))}}function q(e,t){let n={OK:`The file matches an active release in a Release Passport.`,REVOKED:`The project's current holder revoked this release. Do not install it.`,COMPROMISED:`An arbiter confirmed a tampering report against this release. Do not install it.`,UNKNOWN:`No Release Passport lists this file. Do not install it on the passport's word.`,MISMATCH:`This release exists, but it lists no file with this digest.`}[e];return`<div class="verdict v-${D(e)}"><div class="big">${D(e)}</div><p>${n}</p>${t||``}</div>`}async function J(e){e.innerHTML=`
    <h1>Check a download before you install it</h1>
    <p class="lede">Drop a release file here. Your browser computes its sha256 locally, nothing is uploaded, and the
    Release Passport contract on NEAR testnet says whether a project vouches for that exact file.</p>
    <label class="drop" id="drop">
      <input type="file" id="file" />
      <strong>Drop a file</strong> or click to choose one
      <div class="muted" id="hash"></div>
    </label>
    <div class="row" style="margin-top:12px">
      <span class="muted">No file at hand?</span>
      <button class="btn ghost" id="try-good" type="button">Check the published sample</button>
      <button class="btn ghost" id="try-bad" type="button">Check a tampered copy</button>
    </div>
    <div id="result"></div>
    <h2>Or from a terminal</h2>
    <div class="panel"><code>node cli/rp-verify.mjs samples/demo-tool-1.0.0.tgz</code>
      <p class="muted">No wallet, no dependencies. Exit code 0 OK, 2 revoked or compromised, 3 unknown.</p></div>`;let t=e.querySelector(`#drop`),n=e.querySelector(`#file`),r=async t=>{let n=e.querySelector(`#result`);e.querySelector(`#hash`).textContent=`hashing...`;let r=await B(t);e.querySelector(`#hash`).innerHTML=`<span class="mono">${r}</span> · ${D(t.name)}`,n.innerHTML=`<p class="muted">Asking the contract...</p>`;try{let e=await L(`verify_digest`,{sha256:r});if(!e.length)return n.innerHTML=q(`UNKNOWN`);n.innerHTML=e.map(e=>q(e.verdict,`<dl class="kv" style="margin-top:10px">
              <dt>Passport</dt><dd><a href="#/p/${D(e.token_id)}">${D(e.token_id)}</a> · version ${D(e.version)} · ${D(e.file_name)}</dd>
              <dt>Current holder</dt><dd>${M(e.owner_id)}</dd>
              <dt>Security bond</dt><dd>${k(e.bond_locked)} NEAR in ${M(e.wallet_id)}</dd>
              <dt>Arbiter</dt><dd>${M(e.arbiter_id)}</dd>
            </dl>`)).join(``)}catch(e){n.innerHTML=`<p class="error">${D(e.message)}</p>`}};n.addEventListener(`change`,()=>n.files[0]&&r(n.files[0]));let i=async e=>{let t=await(await fetch(`./samples/${e}`)).blob();r(new File([t],e))};e.querySelector(`#try-good`).onclick=()=>i(`demo-tool-1.0.0.tgz`),e.querySelector(`#try-bad`).onclick=()=>i(`demo-tool-1.0.0-tampered.tgz`),t.addEventListener(`dragover`,e=>(e.preventDefault(),t.classList.add(`over`))),t.addEventListener(`dragleave`,()=>t.classList.remove(`over`)),t.addEventListener(`drop`,e=>{e.preventDefault(),t.classList.remove(`over`),e.dataTransfer.files[0]&&r(e.dataTransfer.files[0])})}async function Y(e){e.innerHTML=`<h1>Passports</h1><p class="lede">Every passport is an NFT and a NEAR account with no keys.</p><div id="list">Loading...</div>`;let t=await L(`list_passports`,{from_index:`0`,limit:50});e.querySelector(`#list`).innerHTML=t.length?`<table><tr><th>Passport</th><th>Holder</th><th>Bond</th><th>Latest</th><th>Reports</th></tr>${t.map(e=>`<tr><td><a href="#/p/${D(e.token_id)}">${D(e.token_id)}</a><div class="muted">${D(e.title)}</div></td>
          <td>${M(e.owner_id)}</td><td>${k(e.bond_locked)} NEAR</td><td>${D(e.latest_version||`-`)}</td>
          <td>${e.open_reports} open / ${e.report_ids.length}</td></tr>`).join(``)}</table>`:`<p class="muted">No passports yet.</p>`}async function X(e,t){e.innerHTML=`<p class="muted">Loading ${D(t)}...</p>`;let n=await L(`get_passport`,{token_id:t});if(!n)return e.innerHTML=`<h1>${D(t)}</h1><p>No such passport.</p>`;let[r,i,a,o,s,c]=await Promise.all([L(`list_releases`,{token_id:t}),L(`list_reports`,{token_id:t}),R(n.wallet_id),z(n.wallet_id),z(x),L(`parent_id`,{},n.wallet_id).catch(()=>null)]),l=BigInt(n.bond_locked)+BigInt(n.free_balance)+BigInt(n.in_transit);e.innerHTML=`
    <h1>${D(n.title)} <span class="muted mono">${D(t)}</span></h1>
    <p class="lede"><a href="${O(n.repo_url)}" target="_blank" rel="noopener">${D(n.repo_url)}</a> ·
      <a href="#/p/${D(t)}/history">history</a></p>
    <div class="grid">
      <div class="panel"><div class="muted">Current holder</div>${M(n.owner_id)}<div class="muted">holder epoch ${n.holder_epoch}</div></div>
      <div class="panel"><div class="muted">Security bond</div><strong>${k(n.bond_locked)} NEAR</strong><div class="muted">bounty per confirmed report ${k(n.bounty)} NEAR</div></div>
      <div class="panel"><div class="muted">Withdrawable earnings</div><strong>${k(n.free_balance)} NEAR</strong><div class="muted">earned ${k(n.total_earned)}, paid out ${k(n.total_paid_out)}</div></div>
      <div class="panel"><div class="muted">Arbiter (fixed at mint)</div>${M(n.arbiter_id)}<div class="muted">${n.open_reports} open reports</div></div>
    </div>
    <h2>The passport is an account</h2>
    <div class="panel"><dl class="kv">
      <dt>Account</dt><dd>${M(n.wallet_id)}</dd>
      <dt>Access keys</dt><dd>${o.keys.length===0?`<strong>none</strong> · nobody can sign for this account, so no seller can keep a key`:`<span class="error">${o.keys.length} key(s)</span>`}</dd>
      <dt>Code</dt><dd>global contract <span class="mono">${D(a.global_contract_hash||a.code_hash)}</span> (immutable, by hash)</dd>
      <dt>Obeys</dt><dd>${c?M(c):`-`} only</dd>
      <dt>Real balance</dt><dd>${k(a.amount)} NEAR · ledger says ${k(l.toString())} NEAR</dd>
      <dt>Trust root</dt><dd>the NFT contract ${M(x)} has ${s.keys.length} access key(s); whoever holds them can upgrade it</dd>
    </dl></div>
    ${n.pending_withdrawal?`<div class="notice">Pending withdrawal of ${k(n.pending_withdrawal.amount)} NEAR by ${D(n.pending_withdrawal.requested_by)}, unlocks ${j(n.pending_withdrawal.unlock_at_ns)}. Any transfer cancels it.</div>`:``}
    <h2>Releases</h2>
    ${r.length?r.map(e=>`<div class="panel" style="margin-bottom:10px">
      <div class="row"><strong>${D(e.version)}</strong> ${F(P(e.status))} <span class="muted">published ${j(e.published_at_ns)} by ${D(e.published_by)}</span></div>
      ${N(e.status)===`Revoked`?`<p class="muted">Reason: ${D(e.status.Revoked.reason)}</p>`:``}
      <table><tr><th>File</th><th>sha256</th></tr>${e.files.map(e=>`<tr><td>${D(e.name)}</td><td class="mono">${D(e.sha256)}</td></tr>`).join(``)}</table>
    </div>`).join(``):`<p class="muted">No releases yet.</p>`}
    <h2>Tampering reports</h2>
    ${i.length?`<table><tr><th>#</th><th>Version</th><th>Reporter</th><th>Status</th><th>Note</th></tr>${i.map(e=>`<tr>
      <td>${e.id}</td><td>${D(e.version)}</td><td>${M(e.reporter)}</td><td>${D(N(e.status))}${e.status.Confirmed?` · bounty ${k(e.status.Confirmed.payout)} NEAR`:``}</td>
      <td>${D(e.note)} ${e.evidence_url?`<a href="${O(e.evidence_url)}" target="_blank" rel="noopener">evidence</a>`:``}</td></tr>`).join(``)}</table>`:`<p class="muted">No reports.</p>`}
    <h2>Support this project</h2>
    <div class="row"><input type="text" id="amt" value="0.1" size="6" /> NEAR
      <button class="btn" id="sponsor">Sponsor (goes to the current holder)</button>
      <button class="btn ghost" id="fund">Add to the bond</button></div>`,e.querySelector(`#sponsor`).onclick=n=>K(n.target,()=>G(`sponsor`,{token_id:t,memo:null},A(e.querySelector(`#amt`).value),50n)),e.querySelector(`#fund`).onclick=n=>K(n.target,()=>G(`fund_bond`,{token_id:t},A(e.querySelector(`#amt`).value),50n))}async function Z(e,t){e.innerHTML=`<p class="muted">Loading...</p>`;let[n,r]=await Promise.all([L(`get_passport`,{token_id:t}),L(`passport_history`,{token_id:t,from_index:0,limit:100})]);e.innerHTML=`<h1>History of <a href="#/p/${D(t)}">${D(t)}</a></h1>
    <p class="lede">Every mint, release, payment, report and change of holder, read from the contract. Earned ${k(n?.total_earned)} NEAR, paid out ${k(n?.total_paid_out)} NEAR.</p>
    <table><tr><th>#</th><th>When</th><th>What</th><th>By</th><th>Counterparty</th><th>Amount</th><th>Holder after</th></tr>
    ${r.map(e=>`<tr><td>${e.seq}</td><td>${j(e.at_ns)}</td><td>${D(e.kind.replaceAll(`_`,` `))}${e.ref_id?` <span class="muted">${D(e.ref_id)}</span>`:``}</td>
      <td>${M(e.actor)}</td><td>${M(e.counterparty)}</td><td>${e.amount?`${k(e.amount)} NEAR`:``}</td><td>${M(e.holder)} <span class="muted">epoch ${e.holder_epoch}</span></td></tr>`).join(``)}
    </table>`}async function Q(e){if(!H){e.innerHTML=`<h1>Holder console</h1><p class="lede">Only current passport holders can use this page. Connect a NEAR testnet wallet.</p>
      <button class="btn" id="go">Connect wallet</button>`,e.querySelector(`#go`).onclick=()=>V.connect();return}let t=await L(`nft_tokens_for_owner`,{account_id:H,from_index:`0`,limit:50});if(!t.length)e.innerHTML=`<h1>Holder console</h1><div class="notice">Not a current holder of any passport. If you sold one, its releases,
      bond and earnings now answer to the buyer, and the contract rejects every action from you.</div>`;else{e.innerHTML=`<h1>Holder console</h1><p class="lede">Signed in as ${M(H)}. The contract checks holdership again on every call.</p><div id="tokens" class="stack"></div>`;for(let n of t){let t=await L(`get_passport`,{token_id:n.token_id}),r=document.createElement(`div`);r.className=`panel`,r.innerHTML=`<h2 style="margin-top:0"><a href="#/p/${D(n.token_id)}">${D(n.token_id)}</a></h2>
      <form class="pub"><strong>Publish a release</strong>
        <label>Version <input type="text" name="version" placeholder="1.2.0" required /></label>
        <label>Files (hashed in your browser) <input type="file" name="files" multiple required /></label>
        <label>Source URL <input type="text" name="src" placeholder="https://github.com/..." /></label>
        <button class="btn">Publish</button></form>
      <h2>Revoke a release</h2>
      <div class="row"><select class="rv">${t.versions.map(e=>`<option>${D(e)}</option>`).join(``)}</select>
        <input type="text" class="reason" placeholder="reason" /><button class="btn ghost revoke">Revoke</button></div>
      <h2>Earnings: ${k(t.free_balance)} NEAR withdrawable</h2>
      <div class="row"><input type="text" class="wamt" value="${k(t.free_balance)}" size="8" /> NEAR
        <button class="btn ghost req">Request withdrawal</button><button class="btn ghost exe">Execute</button><button class="btn ghost can">Cancel</button></div>
      ${t.pending_withdrawal?`<p class="muted">Pending ${k(t.pending_withdrawal.amount)} NEAR, unlocks ${j(t.pending_withdrawal.unlock_at_ns)}</p>`:``}
      <h2>Transfer (hands over authority, bond and earnings)</h2>
      <div class="row"><input type="text" class="to" placeholder="buyer.testnet" /><button class="btn ghost xfer">Transfer</button></div>`,e.querySelector(`#tokens`).appendChild(r);let i=n.token_id;r.querySelector(`.pub`).onsubmit=e=>{e.preventDefault();let t=e.target;K(t.querySelector(`button`),async()=>{let e=[];for(let n of t.files.files)e.push({name:n.name,sha256:await B(n),size:String(n.size)});await G(`publish_release`,{token_id:i,version:t.version.value.trim(),files:e,source_url:t.src.value.trim()||null},A(`0.02`))})},r.querySelector(`.revoke`).onclick=e=>K(e.target,()=>G(`revoke_release`,{token_id:i,version:r.querySelector(`.rv`).value,reason:r.querySelector(`.reason`).value||`revoked by holder`},`1`)),r.querySelector(`.req`).onclick=e=>K(e.target,()=>G(`request_withdraw`,{token_id:i,amount:A(r.querySelector(`.wamt`).value)},`1`)),r.querySelector(`.exe`).onclick=e=>K(e.target,()=>G(`execute_withdraw`,{token_id:i},`0`)),r.querySelector(`.can`).onclick=e=>K(e.target,()=>G(`cancel_withdraw`,{token_id:i},`1`)),r.querySelector(`.xfer`).onclick=e=>K(e.target,()=>G(`nft_transfer`,{receiver_id:r.querySelector(`.to`).value.trim(),token_id:i},`1`))}}}async function te(e){let t=await L(`get_config`);e.innerHTML=`<h1>Report a tampered release</h1>
    <p class="lede">You saw a file that claims to be a release but differs from its passport. Stake ${k(t.report_stake)} NEAR.
    If the passport's arbiter confirms, the release is marked COMPROMISED for everyone and you receive the bounty from the
    passport's own account plus your stake back. If the window ends without a decision, your stake comes back.</p>
    <form id="rep">
      <label>Passport <input type="text" name="token" placeholder="demo-tool" required /></label>
      <label>Version <input type="text" name="version" placeholder="1.0.0" required /></label>
      <label>The file you received (hashed locally) <input type="file" name="file" required /></label>
      <label>Evidence URL <input type="text" name="evidence" placeholder="https://..." /></label>
      <label>What is wrong <textarea name="note" rows="3" maxlength="280"></textarea></label>
      <button class="btn">File report</button></form>`,e.querySelector(`#rep`).onsubmit=e=>{e.preventDefault();let n=e.target;K(n.querySelector(`button`),async()=>G(`file_report`,{token_id:n.token.value.trim(),version:n.version.value.trim(),observed_sha256:await B(n.file.files[0]),evidence_url:n.evidence.value.trim(),note:n.note.value.trim()},(BigInt(t.report_stake)+BigInt(A(`0.01`))).toString()))}}async function ne(e){if(!H){e.innerHTML=`<h1>Arbiter</h1><p class="lede">Arbiters confirm or reject tampering reports for the passports that named them. Connect a testnet wallet.</p>`;return}let t=(await L(`list_passports`,{from_index:`0`,limit:50})).filter(e=>e.arbiter_id===H),n=(await Promise.all(t.map(e=>L(`list_reports`,{token_id:e.token_id})))).flat().filter(e=>e.status===`Open`);e.innerHTML=`<h1>Arbiter</h1><p class="lede">Signed in as ${M(H)}. You arbitrate ${t.length} passport(s).</p>
    ${n.length?n.map(e=>`<div class="panel" style="margin-bottom:10px" data-id="${e.id}">
      <strong>#${e.id} · ${D(e.token_id)} ${D(e.version)}</strong> <span class="muted">by ${D(e.reporter)}, deadline ${j(e.deadline_ns)}</span>
      <p>${D(e.note)}</p><p class="mono">observed ${D(e.observed_sha256)}</p>
      ${e.evidence_url?`<p><a href="${O(e.evidence_url)}" target="_blank" rel="noopener">evidence</a></p>`:``}
      <div class="row"><button class="btn yes">Confirm tampering</button><button class="btn ghost no">Reject</button></div></div>`).join(``):`<p class="muted">No open reports.</p>`}`,e.querySelectorAll(`[data-id]`).forEach(e=>{let t=Number(e.dataset.id);e.querySelector(`.yes`).onclick=e=>K(e.target,()=>G(`resolve_report`,{report_id:t,confirmed:!0,note:`confirmed`},`1`)),e.querySelector(`.no`).onclick=e=>K(e.target,()=>G(`resolve_report`,{report_id:t,confirmed:!1,note:`rejected`},`1`))})}async function $(){let e=location.hash.replace(/^#/,``)||`/`;document.querySelectorAll(`nav a`).forEach(t=>t.classList.toggle(`on`,t.getAttribute(`href`)===`#${e}`));let t=document.createElement(`div`);E.replaceChildren(t);try{let n;e===`/`?await J(t):e===`/passports`?await Y(t):(n=e.match(/^\/p\/([a-z0-9-]+)\/history$/))?await Z(t,n[1]):(n=e.match(/^\/p\/([a-z0-9-]+)$/))?await X(t,n[1]):e===`/console`?await Q(t):e===`/report`?await te(t):e===`/arbiter`?await ne(t):t.innerHTML=`<p>Not found. <a href="#/">Verify a file</a></p>`}catch(e){t.innerHTML=`<p class="error">${D(e.message||e)}</p>`}}window.addEventListener(`hashchange`,$),$();