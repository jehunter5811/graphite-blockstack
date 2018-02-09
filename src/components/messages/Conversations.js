import React, { Component } from "react";
import { Link } from "react-router-dom";
import Profile from "../Profile";
import Signin from "../Signin";
import Header from "../Header";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.bubble.css';
import {
  isSignInPending,
  loadUserData,
  Person,
  getFile,
  putFile,
  lookupProfile,
  signUserOut
} from "blockstack";
import update from 'immutability-helper';
const Quill = ReactQuill.Quill;
const Font = ReactQuill.Quill.import('formats/font');
Font.whitelist = ['Ubuntu', 'Raleway', 'Roboto', 'Lato', 'Open Sans', 'Montserrat'] ; // allow ONLY these fonts and the default
ReactQuill.Quill.register(Font, true);
import SingleConversation from './SingleConversation';
import axios from 'axios';

const blockstack = require("blockstack");
const { encryptECIES, decryptECIES } = require('blockstack/lib/encryption');
const { getPublicKeyFromPrivate } = require('blockstack');
const avatarFallbackImage = 'https://s3.amazonaws.com/onename/avatar-placeholder.png';

export default class Conversations extends Component {
  constructor(props) {
    super(props);
    this.state = {
      person: {
  	  	name() {
          return 'Anonymous';
        },
  	  	avatarUrl() {
  	  	  return avatarFallbackImage;
  	  	},
  	  },
      messages: [],
      sharedMessages: [],
      tempMessages: [],
      myMessages: [],
      combinedMessages: [],
      count: "",
      filteredValue: [],
      tempDocId: "",
      redirect: false,
      newMessage: "",
      receiver: "",
      conversationUser: "",
      conversationUserImage: avatarFallbackImage,
      userImg: avatarFallbackImage,
      filteredContacts: [],
      contacts: [],
      redirect: false,
      newContact: "",
      add: false,
      loading: "hide",
      show: "",
      newContactImg: avatarFallbackImage,
      oldMessageCount: "",
      messageCount: "",
      alert: false
    }
    this.handleaddItem = this.handleaddItem.bind(this);
    this.saveNewFile = this.saveNewFile.bind(this);
    this.handleNewContact = this.handleNewContact.bind(this);
    this.newContact = this.newContact.bind(this);
    this.filterList = this.filterList.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  componentWillMount() {
    if (isSignInPending()) {
      handlePendingSignIn().then(userData => {
        window.location = window.location.origin;
      });
    }
  }

  componentDidMount() {
    const publicKey = getPublicKeyFromPrivate(loadUserData().appPrivateKey)
    putFile('key.json', JSON.stringify(publicKey))
    .then(() => {
        console.log("Saved!");
      })
      .catch(e => {
        console.log(e);
      });

    this.setState({receiver: loadUserData().username});
    let info = loadUserData().profile;
    if(info.image) {
      this.setState({ userImg: info.image[0].contentUrl});
    } else {
      this.setState({ userImg: avatarFallbackImage});
    }

    getFile("contact.json", {decrypt: true})
     .then((fileContents) => {
       if(fileContents) {
         console.log("Contacts are here");
         this.setState({ contacts: JSON.parse(fileContents || '{}').contacts });
         this.setState({ filteredContacts: this.state.contacts });
       } else {
         console.log("No contacts");
       }
     })
      .catch(error => {
        console.log(error);
      });

    this.refresh = setInterval(() => this.fetchMine(), 1000);
    this.refresh = setInterval(() => this.fetchData(), 1000);
  }

  fetchMine() {
    const fileName = this.state.conversationUser.slice(0, -3) + '.json';
    getFile(fileName, {decrypt: true})
     .then((fileContents) => {
       if(fileContents) {
         console.log("loaded")
         this.setState({ myMessages: JSON.parse(fileContents || '{}').messages });
       } else {
         console.log("No saved files");
       }
     })
      .catch(error => {
        console.log("fetchmine failed " + error);
      });
  }

  fetchData() {
  const username = this.state.conversationUser;
  const options = { username: username, zoneFileLookupURL: "https://core.blockstack.org/v1/names"}
  getFile('key.json', options)
    .then((file) => {
      this.setState({ pubKey: JSON.parse(file)})
      console.log("Step One: PubKey Loaded");
    })
      .catch(error => {
        console.log(error);
        Materialize.toast(this.state.conversationUser + " has not logged into Graphite yet. Ask them to log in before you share.", 4000);
        this.setState({ conversationUser: "" });
      });

    lookupProfile(username, "https://core.blockstack.org/v1/names")
      .then((profile) => {
        let image = profile.image;
        if(profile.image){
          this.setState({conversationUserImage: image[0].contentUrl})
        }
        this.setState({
          person: new Person(profile),
          username: username
        })
      })
      .catch((error) => {
        console.log('could not resolve profile')
      })
    getFile('/shared/messages/count' + this.state.conversationUser.slice(0, -3) + '.json', {decrypt: true})
      .then((file) => {
        console.log("old message count loaded");
        this.setState({oldMessageCount: JSON.parse(file)})
        console.log(this.state.oldMessageCount);
      })

    const fileName = loadUserData().username.slice(0, -3) + '.json';
    const privateKey = loadUserData().appPrivateKey;
    const directory = '/shared/messages/' + fileName;
    getFile(directory, options)
      .then((file) => {
        console.log("fetched!");

        this.setState({ tempMessages: JSON.parse(decryptECIES(privateKey, JSON.parse(file))) });
        let temp = this.state.tempMessages;
        this.setState({ sharedMessages: temp.messages});
        this.setState({ messageCount: temp.messages.length })
        console.log("Message count = " + this.state.messageCount)
        this.setState({ combinedMessages: [...this.state.myMessages, ...this.state.sharedMessages] });
        this.setState({ loading: "hide", show: "" });
        this.scrollToBottom();
      })
      .then(() => {
        putFile('/shared/messages/count' + this.state.conversationUser.slice(0, -3) + '.json', JSON.stringify(this.state.messageCount), { encrypt: true })
          .then(() => {
            console.log("Message count saved");
          })
          .catch(e => {
            console.log(e);
          });
      })
      .catch((error) => {
        console.log('could not fetch shared messages: ' + error);
      })
  }

  newContact() {
    this.setState({add: true});
  }

  handleaddItem() {
    const today = new Date();
    const object = {};
    let combinedMessages;
    if(this.state.combinedMessages.length <1) {
      combinedMessages = this.state.myMessages;
    } else {
      combinedMessages = this.state.combinedMessages;
    }
    function compare(a,b) {
      return a.id - b.id
    }
    let messages = combinedMessages.sort(compare);
    var ids = messages.map(a => a.id);
    console.log(ids);
    if(ids.length > 0) {
      console.log(true);
      let random = Math.random()*0.08;
      let calc = 1 + random;
      let newID = ids.slice(-1)[0]*calc;
      console.log("Calculated ID");
      object.id = parseInt(newID.toFixed(0));
    } else {
      object.id = Date.now();
      console.log("Datestamp ID");
    }
    object.content = this.state.newMessage;
    object.created = today.toString();
    object.sender = loadUserData().username;
    object.receiver = this.state.conversationUser;

    this.setState({ messages: [...this.state.myMessages, object] });
    this.setState({newMessage: ""});
    setTimeout(this.saveNewFile, 500);
}

  saveNewFile() {
    const fileName = this.state.conversationUser.slice(0, -3) + '.json';
    putFile(fileName, JSON.stringify(this.state), {encrypt: true})
      .then(() => {
        console.log("Saved!");
        this.saveShared();
      })
      .catch(e => {
        console.log(e);
      });
  }

  saveShared() {
    const fileName = this.state.conversationUser.slice(0, -3) + '.json';
    const publicKey = this.state.pubKey;
    const data = this.state;
    const encryptedData = JSON.stringify(encryptECIES(publicKey, JSON.stringify(data)));
    const directory = '/shared/messages/' + fileName;
    putFile(directory, encryptedData)
      .then(() => {
        console.log("Shared encrypted file " + directory);
      })
      .catch(e => {
        console.log(e);
      });
  }

  scrollToBottom = () => {
    this.messagesEnd.scrollIntoView({ behavior: "smooth" });
  }

  handleMessage(value) {
    this.setState({ newMessage: value })
  }

  handleSignOut(e) {
    e.preventDefault();
    signUserOut(window.location.origin);
  }

  handleNewContact(e) {
    this.setState({ newContact: e.target.value })
  }

  filterList(event){
    var updatedList = this.state.contacts;
    updatedList = updatedList.filter(function(item){
      return item.contact.toLowerCase().search(
        event.target.value.toLowerCase()) !== -1;
    });
    this.setState({filteredContacts: updatedList});
  }


  renderView() {
    let contacts = this.state.filteredContacts;
    const userData = blockstack.loadUserData();
    const person = new blockstack.Person(userData.profile);
    let combinedMessages;
    if(this.state.combinedMessages.length <1) {
      combinedMessages = this.state.myMessages;
    } else {
      combinedMessages = this.state.combinedMessages;
    }
    function compare(a,b) {
      return a.id - b.id
    }
    let messages = combinedMessages.sort(compare);
    let myMessages = this.state.myMessages;
    let sharedMessages = this.state.sharedMessages;
    let show = this.state.show;
    let loading = this.state.loading;
    if(this.state.conversationUser === "") {
      return(
        <h5 className="center-align">Select a contact to start or continue a conversation.</h5>
      );
    } else {
      SingleConversation.modules = {
        toolbar: [
          [{ 'header': '1'}, {'header': '2'}, { 'font': Font.whitelist }],,
          [{size: []}],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{'list': 'ordered'}, {'list': 'bullet'},
           {'indent': '-1'}, {'indent': '+1'}],
          ['link', 'image', 'video'],
          ['clean']
        ],
        clipboard: {
          // toggle to add extra line breaks when pasting HTML:
          matchVisual: false,
        }
      }
      /*
       * Quill editor formats
       * See https://quilljs.com/docs/formats/
       */
      SingleConversation.formats = [
        'header', 'font', 'size',
        'bold', 'italic', 'underline', 'strike', 'blockquote',
        'list', 'bullet', 'indent',
        'link', 'image', 'video'
      ]

      return (
        <div>
          <div className="container loader">
            <div className={loading}>
              <div className="progress center-align">
                <p>Loading...</p>
                <div className="indeterminate"></div>
              </div>
            </div>
          </div>
          <div className={show}>
          <div>
          {messages.map(message => {
            if(message.sender == loadUserData().username || message.receiver == loadUserData().username){
              if(message.sender == loadUserData().username) {
                return (
                  <div key={message.id} className="main-covo">

                    <div className="bubble sender container row">
                      <div className="col s8">
                        <p dangerouslySetInnerHTML={{ __html: message.content }} />
                        <p className="muted">{message.created}</p>
                      </div>
                      <div className="col s4">
                        <img className="responsive-img sender-message-img circle" src={this.state.userImg} alt="avatar" />
                      </div>
                    </div>
                  </div>
                )
              } else {
                return (
                  <div key={message.id} className="">

                    <div className="bubble receiver container row">
                      <div className="col s4">
                        <img className="responsive-img receiver-message-img circle" src={this.state.conversationUserImage} alt="avatar" />
                      </div>
                      <div className="col s8">
                        <p dangerouslySetInnerHTML={{ __html: message.content }} />
                        <p className="muted">{message.created}</p>
                      </div>
                    </div>
                  </div>
                )
              }
            }else {
              return (
                <div></div>
              )
            }
            })
          }
          </div>
            <div style={{ float:"left", clear: "both" }}
              ref={(el) => { this.messagesEnd = el; }}>
            </div>
          </div>
          <div className="center-align message-input container white">
            <ReactQuill
              id="textarea1"
              className="materialize-textarea print-view"
              placeholder="Send a message"
              theme="bubble"
              value={this.state.newMessage}
              onChange={this.handleMessage}
              modules={SingleConversation.modules}
              formats={SingleConversation.formats}
              />

            <button onClick={this.handleaddItem} className="waves-effect waves-light btn">Send</button>
          </div>

        </div>
      );
    }
  }


  render(){
    let contacts = this.state.filteredContacts;
    const userData = blockstack.loadUserData();
    const person = new blockstack.Person(userData.profile);
    let show = this.state.show;
    let loading = this.state.loading;
    return(
      <div>
      <div className="navbar-fixed toolbar">
        <nav className="toolbar-nav">
          <div className="nav-wrapper">
            <a href="/conversations" className="brand-logo">Graphite.<img className="people" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9%0D%0AIjgiIHZpZXdCb3g9IjAgMCA4IDgiPgogIDxwYXRoIGQ9Ik0wIDB2NWwxLTFoMXYtM2gzdi0xaC01%0D%0Aem0zIDJ2NGg0bDEgMXYtNWgtNXoiIC8+Cjwvc3ZnPg==" alt="chat bubble" /></a>

            <ul id="nav-mobile" className="right">
            <ul id="dropdown1" className="dropdown-content">
              <li><a href="/export">Export All Data</a></li>
              <li className="divider"></li>
              <li><a href="#" onClick={ this.handleSignOut }>Sign out</a></li>
            </ul>
            <ul id="dropdown2" className="dropdown-content">
            <li><a href="/documents"><i className="material-icons blue-text text-darken-2">description</i><br />Documents</a></li>
            <li><a href="/sheets"><i className="material-icons green-text text-lighten-1">grid_on</i><br />Sheets</a></li>
            <li><a href="/contacts"><i className="material-icons purple-text lighten-3">contacts</i><br />Contacts</a></li>
            <li><a href="/conversations"><i className="material-icons orange-text accent-2">chat</i><br />Conversations</a></li>
            </ul>
              <li><a className="dropdown-button" href="#!" data-activates="dropdown2"><i className="material-icons apps">apps</i></a></li>
              <li><a className="dropdown-button" href="#!" data-activates="dropdown1"><img src={ person.avatarUrl() ? person.avatarUrl() : avatarFallbackImage } className="img-rounded avatar" id="avatar-image" /><i className="material-icons right">arrow_drop_down</i></a></li>
            </ul>
          </div>
        </nav>
        </div>
        <div>
            <div className="row">
              <div className="col s3 convo-left">
                <Link to={'/contacts'}><div className="card">
                  <div className="center-align card-content">
                    <p><i className="medium material-icons">add</i></p>
                  </div>
                  <div className="card-action">
                    <a className="black-text">New Contact</a>
                  </div>
                </div></Link>
                {contacts.slice(0).reverse().map(contact => {
                    return (
                      <div key={contact.contact}>

                        <div className="card renderedDocs">
                        <a onClick={() => this.setState({ conversationUser: contact.contact, combinedMessages: [], conversationUserImage: avatarFallbackImage })} className="conversation-click black-text">
                          <div className="card-action center-align">
                            <a className="conversation-click" onClick={() => this.setState({ user: contact.contact, combinedMessages: [], conversationUserImage: avatarFallbackImage })}><img className="responsive-img circle conversations-img" src={contact.img} alt="profile" /></a>
                          </div>
                        </a>
                          <div className="card-action">

                            <a onClick={() => this.setState({ conversationUser: contact.contact, combinedMessages: [], conversationUserImage: avatarFallbackImage })} className="conversation-click black-text">{contact.contact}</a>
                            <a onClick={() => this.setState({ conversationUser: contact.contact, combinedMessages: [], conversationUserImage: avatarFallbackImage })}><i className="conversation-click modal-trigger material-icons right orange-text accent-2">chat</i></a>
                          </div>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
              <div className="col s9 convo-right">
                <div className="card convo-card">
                  {this.renderView()}
                </div>
              </div>
              </div>


        </div>
      </div>
    )
  }
}
