import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { withRouter } from 'react-router-dom'
import { I18n } from 'react-redux-i18n'
import _, { entries } from 'lodash'
import { Button, Row, Form, Input, Icon, Dropdown, Menu, message, Popover, Radio, Mentions } from 'antd'
import { config } from '@/config'
import ListItem from '@/components/list/ListItem'
import ChatMessage from '@/components/chat/ChatMessage'
import ChatEmoji from '@/components/chat/ChatEmoji'
import styles from './style/index.less'
import LoginActions from '@/redux/LoginRedux'
import MessageActions from '@/redux/MessageRedux'
import GroupActions from '@/redux/GroupRedux'
import GroupMemberActions from '@/redux/GroupMemberRedux'
import StrangerActions from '@/redux/StrangerRedux'
import RosterActions from '@/redux/RosterRedux'
import BlacklistActions from '@/redux/BlacklistRedux'
import VideoCallActions from '@/redux/VideoCallRedux'
import AIBotActions from '@/redux/AIBotRedux'
import WebIM from '@/config/WebIM'
import { history } from '@/utils'
import utils from '@/utils'
import getTabMessages from '@/selectors/ChatSelector'
import AddAVMemberModal from '@/components/videoCall/AddAVMemberModal'
import ModalComponent from '@/components/common/ModalComponent'
import RecordAudio from '@/components/recorder/index'
import UserInfoModal from '@/components/contact/UserInfoModal'
import { MENTION_ALL, BOT_NAME } from '@/const/'
import ReplyMessage from '@/components/chat/ReplyMessage'
import GroupInput from '@/containers/chat/GroupInput'
import ChatInput from '@/containers/chat/ChatInput'
import CommandHelpModal from './CommandHelpModal'
import { SendMessage, GroupSummary, RequestBot } from '@/config/api'
import { AskBot } from '../../config/api'
// import { getLinkPreview, getPreviewFromContent } from 'link-preview-js'
// import fetch from 'isomorphic-unfetch'
// import spotify from 'spotify-url-info'
// const { getData, getPreview, getTracks, getDetails } = spotify(fetch)
let groupMemberNickIdMap = {}
const rtc = WebIM.rtc
const { TextArea } = Input
const FormItem = Form.Item
const { PAGE_NUM } = config
const Message = message
const chatType = {
    contact: 'chat',
    group: 'groupchat',
    chatroom: 'chatroom',
    stranger: 'stranger'
}

function isContain(dom) {
    const totalHeight = window.innerHeight || document.documentElement.clientHeight
    const totalWidth = window.innerWidth || document.documentElement.clientWidth
    // 当滚动条滚动时，top, left, bottom, right时刻会发生改变。
    const { top, right, bottom, left } = dom.getBoundingClientRect()
    return (top >= 0 && left >= 0 && right <= totalWidth && bottom <= totalHeight)
}

var scrollTimer
const timeout = 500
function getCurrentUids(groupId, groupMemberAttrs) {
    let arr = []
    let hasAttrUidList = Object.keys(groupMemberAttrs?.[groupId] || {})
    let childrenList = document.getElementsByClassName('x-message-group')
    for (var dom of childrenList) {
        if (isContain(dom)) {
            let uid = dom.getAttribute('uid')
            if (uid && !hasAttrUidList.includes(uid)) {
                arr.push(uid)
            }
        }
    }

    let uids = [...new Set(arr)]
    return uids
};

class Chat extends React.Component {
    input = null // eslint-disable-line
    image = null // eslint-disable-line
    timer = null

    constructor({ match }) {
        super()
        const { selectTab, selectItem = '' } = match.params
        this.state = {
            showWebRTC: false,
            selectTab,
            selectItem,
            value: '',
            isLoaded: false,
            visible: false,
            checkedValue: '',
            showUserInfoMoadl: false,
            showBotModal: false,
            mentionList: [],
            showBotRoles: true,
        }
        this.userInfo = {}
        this.showEdit = false
        this.handleSend = this.handleSend.bind(this)
        this.handleChange = this.handleChange.bind(this)
        this.pictureChange = this.pictureChange.bind(this)
        this.fileChange = this.fileChange.bind(this)
        this.handleEmojiSelect = this.handleEmojiSelect.bind(this)
        this.handleEmojiCancel = this.handleEmojiCancel.bind(this)
        this.handleKey = this.handleKey.bind(this)
        this.handleRightIconClick = this.handleRightIconClick.bind(this)
        this.onMenuContactClick = this.onMenuContactClick.bind(this)
        this.setMentionList = this.setMentionList.bind(this)
        this.handleCallBot = this.handleCallBot.bind(this)
        this.emitEmpty = this.emitEmpty.bind(this)

        this.logger = WebIM.loglevel.getLogger('chat component')
    }

    scollBottom() {
        if (!this._not_scroll_bottom) {
            setTimeout(() => {
                const dom = this.refs['x-chat-content']
                if (!ReactDOM.findDOMNode(dom)) return
                dom.scrollTop = dom.scrollHeight
            }, 0)
        }
    }

    pictureChange(e) {
        const { match } = this.props
        const { selectItem, selectTab } = match.params
        const isRoom = chatType[selectTab] == 'chatroom' || chatType[selectTab] == 'groupchat'

        let file = WebIM.utils.getFileUrl(e.target)

        if (!file.filename) {
            this.image.value = null
            return false
        }

        if (!config.imgType[file.filetype.toLowerCase()]) {
            this.image.value = null
            // todo i18n
            return message.error(`${I18n.t('invalidType')}: ${file.filetype}`, 1)
        }
        let msg = this.addReplyMsg({})
        this.props.sendImgMessage(chatType[selectTab], selectItem, { isRoom }, file, msg.ext, () => {
            this.image.value = null
        })
        this.props.replyMessage(null)
    }

    fileChange(e) {
        const { match } = this.props
        const { selectItem, selectTab } = match.params
        const isRoom = chatType[selectTab] == 'chatroom' || chatType[selectTab] == 'groupchat'

        let file = WebIM.utils.getFileUrl(e.target)

        if (!file.filename) {
            this.file.value = null
            return false
        }
        let msg = this.addReplyMsg({})
        this.props.sendFileMessage(chatType[selectTab], selectItem, { isRoom }, file, msg.ext, () => {
            this.file.value = null
        })
        this.props.replyMessage(null)
    }

    handleEmojiSelect(v) {
        this.setState({
            value: (this.state.value || '') + v.key
        }, () => {
            this.logger.info('callback')
            this.logger.info(this.state.value)
        })
        this.logger.info('async')
        this.logger.info(this.state.value)
        this.input.focus()
    }

    handleEmojiCancel() {
        if (!this.state.value) return
        const arr = this.state.value.split('')
        const len = arr.length
        let newValue = ''

        if (arr[len - 1] != ']') {
            arr.pop()
            newValue = arr.join('')
        } else {
            const index = arr.lastIndexOf('[')
            newValue = arr.splice(0, index).join('')
        }

        this.setState({
            value: newValue
        })
    }

    setMentionList({ value }) {
        this.setState({
            mentionList: [...this.state.mentionList, value]
        })
    }

    handleChange(e) {
        const { selectTab } = this.props.match.params
        const v = e
        const splitValue = this.state?.value ? this.state?.value.split('') : []
        splitValue.pop()
        if (v == splitValue.join('')) {
            this.handleEmojiCancel()
        } else {
            this.setState({
                value: v
            })
        }
    }

    handleCallBot(value, isGroup) {
        const { match } = this.props
        const { selectItem, selectTab } = match.params
        const userId = WebIM.conn.context.userId
        let cmd = ""
        let params = ""
        if (isGroup) {
            cmd = value.split(' ')
            if (cmd.length < 2) {
                message.info("ai-bot 不支持当前命令");
                return
            }
            cmd = cmd[1]
        } else {
            cmd = value.substring(1).split(' ')
            params = cmd.slice(1)
            cmd = cmd[0]
        }
        // console.log("call bot", selectItem, cmd, userId)
        if (cmd === "summary" && isGroup) {
            GroupSummary(selectItem).then((res) => {
                console.log('summary', res)
            })
        } else if (cmd === "add" && isGroup) {
            RequestBot(selectItem).then((res) => {
                if (res === "ok") {
                    message.info("添加机器人成功")
                } else {
                    message.info("添加机器人失败")
                }
            })
        } else if (cmd === "list" && !isGroup) {
            if (this.props.aiRoles.length === 0) {
                this.props.updateRoles()
            }
            this.setState({
                showBotRoles: true
            })
            console.log("list cmd")
        } else if (cmd === "use" && !isGroup && params.length == 1) {
            const param = params[0]
            this.props.setRole(param)
            console.log("use cmd", param)
        } else if (cmd === "ask" && !isGroup) {
            const param = params.join(' ')
            let msg = {
                msg: value
            }
            this.props.sendTxtMessage(chatType[selectTab], selectItem, msg)
            AskBot(param, this.props.userRole || '1', userId, selectItem)
            console.log("ask cmd ", param)
        } else if (cmd === "help") {
            this.setState({
                showBotModal: true
            })
        } else {
            message.info("ai-bot 不支持当前命令 " + cmd)
        }
    }

    handleHelpModalClose = () => {
        this.setState({
            showBotModal: false
        })
    }

    handleSend(e, callBot = false) {
        if (e.charCode === 13) {
            e.preventDefault?.()
            const { match } = this.props
            const { selectItem, selectTab } = match.params
            const isGroupChat = chatType[selectTab] === 'groupchat'
            const { value, mentionList } = this.state
            const userId = WebIM.conn.context.userId

            let atList = []
            if (isGroupChat && mentionList.length) {
                atList = mentionList
                    .filter((item) => {
                        return value.includes(`@${item}`)
                    })
                    .map((nickItem) => {
                        return groupMemberNickIdMap[nickItem]
                    })
            }
            if (!value) return
            if (callBot) {
                this.handleCallBot(value, isGroupChat)
            } else {
                let msg = isGroupChat
                    ? {
                        msg: value,
                        ext: {
                            em_at_list: mentionList.includes(MENTION_ALL) ? MENTION_ALL : [...new Set(atList)]
                        }
                    }
                    : {
                        msg: value
                    }
                msg = this.addReplyMsg(msg)
                console.log('send msg', msg)
                SendMessage(msg.msg, selectItem, userId)
                this.props.sendTxtMessage(chatType[selectTab], selectItem, msg)
            }
            this.setState({
                mentionList: []
            })
            this.emitEmpty()
            this.props.replyMessage(null)
        }
    }

    emitEmpty() {
        this.setState({
            value: ''
            // height: 34
        })
        this.input.value = ''
        this.input.focus()
    }

    handleKey(e) {
        if (e.keyCode == 8 || e.keycode == 46) {
            this.handleEmojiCancel()
        }
    }

    /**
     * click event for button at top-right corner
     *
     * @memberof Chat
     */
    handleRightIconClick() {
        const { match } = this.props
        const { selectTab } = match.params
        // const { selectTab } = this.state
        if (selectTab === 'group') {
            const rightSiderOffset = -1 * config.RIGHT_SIDER_WIDTH
            this.props.switchRightSider({ rightSiderOffset })
        }
    }

    renderContactMenu(selectTab) {
        let tabs = null
        if (selectTab == 'contact') {
            tabs = [
                ['0', `${I18n.t('block')}`, 'iconfont icon-circle-minus'],
                ['1', `${I18n.t('delAFriend')}`, 'iconfont icon-trash']
            ]
        } else {
            // stranger
            tabs = [
                ['2', `${I18n.t('addFriend')}`, 'anticon anticon-user-add'],
                ['3', `${I18n.t('delete')}`, 'iconfont icon-trash']
            ]
        }

        const tabsItem = tabs.map(([key, name, icon]) =>
            <Menu.Item key={key}>
                <i className={icon} style={{ fontSize: 20, marginRight: 12, verticalAlign: 'middle' }} />
                <span>
                    <span>
                        {name}
                    </span>
                </span>
            </Menu.Item>
        )
        const menuSettings = (
            <Menu className="x-header-ops__dropmenu" onClick={this.onMenuContactClick}>
                {tabsItem}
            </Menu>
        )

        return menuSettings
    }

    onMenuContactClick({ key }) {
        const { match } = this.props
        const { selectItem, selectTab } = match.params
        const search = history.location.search
        switch (key) {
            case '0':
                // block a friend
                this.props.doAddBlacklist(selectItem)
                history.push('/contact' + search)
                break
            case '1':
                // delete a friend
                this.props.removeContact(selectItem)
                history.push('/contact' + search)
                break
            case '2':
                // add a friend
                this.props.addContact(selectItem)
                message.success(`${I18n.t('addFriendMessage')}`)
                break
            case '3':
                // delete
                this.props.deleteStranger(selectItem)
                history.push('/stranger' + search)
                break
            default:
        }
    }

    onClearMessage = () => {
        const { selectItem, selectTab } = _.get(this.props, ['match', 'params'], {})
        const chatTypes = { 'contact': 'chat', 'group': 'groupchat', 'chatroom': 'chatroom', 'stranger': 'stranger' }
        const chatType = chatTypes[selectTab]
        this.props.clearMessage(chatType, selectItem)
    }

    componentWillReceiveProps(nextProps) {
        // setTimeout(this.scollBottom, 0)
        // this.scollBottom()
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps?.entities?.group?.groupMemberAttrsMap === this.props?.entities?.group?.groupMemberAttrsMap) {
            this.scollBottom()
        }
    }

    /**
     * componentDidMount
     *
     * @memberof Chat
     *
     * Note: get group members, muted members and group admins when in a group.
     * Especially recommend get muted members here.
     * Because, it will check current user in or not in muted list when sending a group message.
     */
    componentDidMount() {
        this.scollBottom()
    }

    componentWillUnmount() {
        if (this.timer) clearTimeout(this.timer)
    }

    callVideo = () => {
        if (this.props.callStatus > 0) {
            console.log(this.props.callStatus)
            return Message.error('正在通话中')
        }
        const {
            match,
            message
        } = this.props
        const { selectItem, selectTab } = match.params
        const value = '邀请您进行视频通话'
        const callId = WebIM.conn.getUniqueId().toString()
        const channelName = Math.uuid(8)
        if (selectTab === 'contact') {
            this.props.sendTxtMessage(chatType[selectTab], selectItem, {
                msg: value,
                ext: {
                    action: 'invite',
                    channelName: channelName,
                    type: 1, //0为1v1音频，1为1v1视频，2为多人通话
                    callerDevId: WebIM.conn.context.jid.clientResource, // 主叫方设备Id
                    callId: callId, // 随机uuid，每次呼叫都不同，代表一次呼叫
                    ts: Date.now(),
                    msgType: 'rtcCallWithAgora'
                }
            })
            this.props.updateConfr({
                ext: {
                    channelName: channelName,
                    type: 1,
                    callerDevId: WebIM.conn.context.jid.clientResource,
                    callId: callId
                },
                to: selectItem,
                callerIMName: WebIM.conn.context.jid.name,
                calleeIMName: selectItem
            })
        } else if (selectTab === 'group') {
            this.props.showInviteModal()
            this.props.setGid(selectItem)
            // this.props.updateConfrInfo(selectItem, false, false)
        }
        const inviteStatus = 1
        this.props.setCallStatus(inviteStatus)
        let to = selectItem
        rtc.timer && clearTimeout(rtc.timer)
        rtc.timer = setTimeout(() => {
            if (selectTab === 'contact') {
                this.props.cancelCall(to)
                this.props.hangup()
            } else {
                // 多人不做超时
            }
        }, 30000)
    }

    handleModalClose = () => {
        this.props.closeInviteModal()
    }

    callVoice = () => {
        const {
            match,
            message
        } = this.props
        if (this.props.callStatus > 0) {
            console.log(this.props.callStatus)
            return Message.error('正在通话中')
        }
        const { selectItem, selectTab } = match.params
        const value = '邀请您进行语音通话'

        const callId = WebIM.conn.getUniqueId().toString()
        const channelName = Math.uuid(8)
        this.props.sendTxtMessage(chatType[selectTab], selectItem, {
            msg: value,
            ext: {
                action: 'invite',
                channelName: channelName,
                type: 0, //0为1v1音频，1为1v1视频，2为多人通话
                callerDevId: WebIM.conn.context.jid.clientResource, // 主叫方设备Id
                callId: callId, // 随机uuid，每次呼叫都不同，代表一次呼叫
                ts: Date.now(),
                msgType: 'rtcCallWithAgora',
                callerIMName: WebIM.conn.context.jid.name
            }
        })
        this.props.updateConfr({
            ext: {
                channelName: channelName,
                token: null,
                type: 0,
                callerDevId: WebIM.conn.context.jid.clientResource,
                callId: callId
            },
            to: selectItem,
            calleeIMName: selectItem,
            callerIMName: WebIM.conn.context.jid.name
        })
        const inviteStatus = 1
        this.props.setCallStatus(inviteStatus)
        let to = selectItem
        rtc.timer && clearTimeout(rtc.timer)
        rtc.timer = setTimeout(() => {
            if (selectTab === 'contact') {
                this.props.cancelCall(to)
                this.props.hangup()
            } else {
                // 多人不做超时
            }
        }, 30000)
    }

    handleScroll = (e) => {
        const _this = this
        if (e.target.scrollTop === 0) {
            // TODO: optimization needed
            setTimeout(function () {
                const offset = _this.props.messageList ? _this.props.messageList.length : 0
                const { selectItem, selectTab } = _.get(_this.props, ['match', 'params'], {})
                const chatTypes = { 'contact': 'chat', 'group': 'groupchat', 'chatroom': 'chatroom', 'stranger': 'stranger' }
                const chatType = chatTypes[selectTab]

                // load more history message
                _this.props.fetchMessage(selectItem, chatType, offset, (res) => {

                    // no more history when length less than 20
                    if (res < PAGE_NUM) {
                        _this.setState({
                            isLoaded: true
                        })

                        _this._not_scroll_bottom = false
                    }
                })

                _this._not_scroll_bottom = true
            }, 500)
        }

        let groupId = this.props.entities.group.currentId
        if (groupId) {
            clearTimeout(scrollTimer)
            scrollTimer = setTimeout(() => {
                let uids = getCurrentUids(groupId, this.props.entities.group?.groupMemberAttrsMap)
                if (uids.length > 0) {
                    return WebIM.conn.getGroupMembersAttributes({
                        groupId,
                        userIds: uids,
                        keys: []
                    }).then((res) => {
                        this.props.setGroupMemberAttr({ groupId, attributes: res.data })
                    }).catch((e) => {
                        let attrs = {}
                        uids.forEach((item) => {
                            attrs[item] = { nickName: '' }
                        })
                        this.props.setGroupMemberAttr({ groupId, attributes: attrs })
                    })
                }
            }, timeout)
        }
    }
    recallMsg = (id) => {
        this.props.deleteMessage(id, true)
    }

    editedMsg = (id, msg) => {
        this.props.editedMessage(id, msg)
    }

    handleHoverChange = (visible)=>{
        this.setState({
            visible
        })
    }

    onChange = e => {
        this.setState({
            checkedValue: e.target.value,
        })
    };

    sendIdCardMsg = async () => {
        const { selectItem, selectTab } = this.props.match.params
        let chatType
        if (selectTab === 'contact') {
            chatType = 'singleChat'
        } else if (selectTab === 'group') {
            chatType = 'groupchat'
        } else {
            chatType = 'chatroom'
        }

        let userId = this.state.checkedValue

        let info = await this.props.getUserInfo(userId)
        info = info.data[userId]
        let msg = {
            userId: userId,
            nick: info.nickname || '',
            avatar: info.avatarurl || ''
        }
        msg = this.addReplyMsg(msg)
        this.props.sendCustomMsg(chatType, selectItem, msg)
        this.setState({
            visible: false
        })
        this.props.replyMessage(null)
    }
    addReplyMsg = (msg) => {
        const { reply } = this.props.entities.message
        if (reply) {
            if (!msg.ext) {
                msg.ext = {}
            }
            let bySelf = reply.from == WebIM.conn.user || reply.from == ''
            let msgId = bySelf ? reply.toJid : reply.id
            let msgPreview = ''
            switch (reply.body.type) {
                case 'txt':
                    msgPreview = reply.body.msg
                    break
                case 'img':
                    msgPreview = '[Image]'
                    break
                case 'audio':
                    msgPreview = '[Voice]'
                    break
                case 'video':
                    msgPreview = '[Video]'
                    break
                case 'file':
                    msgPreview = '[File]'
                    break
                case 'custom':
                    msgPreview = '[Custom]'
                    break
                default:
                    msgPreview = '[unknown]'
                    break
            }
            msg.ext.msgQuote = {
                'msgID': msgId, //原消息 id
                'msgPreview': msgPreview, //原消息的描述，用于显示在消息列表气泡中，超过字符限制将被截取,
                'msgSender': reply.from || WebIM.conn.user,//原消息的发送者，建议使用备注名或昵称,
                'msgType': reply.body.type, //原消息类型,
            }
        }
        return msg
    }
    onClickIdCard = async (data) => {
        let res = await this.props.getUserInfo(data.uid)
        let info = res.data[data.uid]
        this.userInfo = info
        this.userInfo.userId = data.uid
        // this.showEdit = data.uid == WebIM.conn.context.userId
        this.setState({
            showUserInfoMoadl: true
        })
    }
    handleInfoModalClose = () => {
        this.setState({
            showUserInfoMoadl: false
        })
    }

    getGroupMember = () => {
        let { entities, roomId } = this.props
        const members = _.get(entities.groupMember, `${roomId}.byName`, [])
        let groupInfo = entities.group
        return _.map(members, (val, key) => {
            const { info, name } = val

            let nickname =
                groupInfo?.groupMemberAttrsMap?.[roomId]?.[name]?.nickName ||
                info.nickname ||
                val.name
            groupMemberNickIdMap[nickname] = name

            return {
                name: nickname,
                key,
                id: name
            }
        }).filter((item) => {
            return item.id !== WebIM.conn.user
        })
    };

    isCanModifiedMessage = () =>{
      let { entities, roomId } = this.props;
      let allMember =  _.get(entities.groupMember, `${roomId}.byName`, []);
      let admins =  _.get(entities.groupMember, `${roomId}.admins`, []);
      return  admins?.includes(WebIM.conn.user) || allMember?.[WebIM.conn.user]?.affiliation === 'owner'
    }

    getFromNick = (selectTab, userinfos, message) => {
        if (selectTab === 'contact') {
            return userinfos
        } else if (selectTab === 'group') {
            let groupId = this.props.entities.group.currentId
            let from = message.from
            if (!from) {
                from = WebIM.conn.user
            }
            return this.props.entities.group?.groupMemberAttrsMap?.[groupId]?.[from]?.nickName || userinfos[from]?.info?.nickname || from
        }
    };

    reply = (mid, data) => {
        let ext = data.ext?.asMutable() || {}
        let msgId = data.bySelf ? data.toJid : data.id
        ext.msgQuote = {
            msgID: msgId,
            msgPreview: data.body.msg,
            msgSender: data.from || WebIM.conn.user,
            msgType: data.body.type
        }

        let msg = {
            ...data,
            bySelf: false,
            ext
        }
        this.props.replyMessage(msg)
    }

    gotoMessage = (data) => {
        const msgId = data.ext?.msgQuote.msgID
        const replyMsgType = data.ext?.msgQuote.msgType
        let anchorElement = document.getElementById(msgId)

        if (!anchorElement) {
            return message.error('原消息无法定位')
        }
        anchorElement.scrollIntoView(
            { behavior: 'smooth' }
        )

        anchorElement.childNodes[1].childNodes[0].classList.add('twinkle')

        setTimeout(() => {
            anchorElement.childNodes[1].childNodes[0].classList.remove('twinkle')
        }, 2000)
    }

    render() {
        this.logger.info('chat component render')
        let {
            collapsed,
            match,
            history,
            location,
            messageList,
            messageListByMid,
            confrModal,
            inviteModal,
            roomId,
            entities,
        } = this.props
        const { selectItem, selectTab } = match.params

        const back = () => {
            const redirectPath = '/' + [selectTab].join('/') + location.search
            history.push(redirectPath)
        }

        let name = selectItem
        let webrtcButtons = []
        let userinfos = {}

        let isShowDeleteGroupNotice = selectTab === 'group' && entities?.group?.currentGroupCustom !== 'default'
        if (selectTab === 'contact') {
            let withInfoUsers = this.props.entities.roster.byName
            userinfos = name = withInfoUsers ? withInfoUsers[selectItem]?.info?.nickname || name : name
        }
        if (selectTab === 'group') {
            userinfos = this.props.entities.groupMember[selectItem]?.byName || {}
        }

        if (WebIM.config.isWebRTC) {
            if (selectTab === 'contact') {
                // webrtc video button
                webrtcButtons.push(<label key="video" htmlFor="clearMessage" className="x-chat-ops-icon ib"
                    onClick={this.callVideo}>
                    <i className="icon iconfont icon-camera-video"></i>
                </label>)
                // webrtc audio button
                webrtcButtons.push(<label key="audio" htmlFor="clearMessage" className="x-chat-ops-icon ib"
                    onClick={this.callVoice}>
                    <Icon type="phone" style={{ verticalAlign: 'unset', fontSize: '15px' }} />
                </label>)
            }
            if (selectTab === 'group') {
                // webrtc video button
                webrtcButtons.push(<label key="video" htmlFor="clearMessage" className="x-chat-ops-icon ib"
                    onClick={this.callVideo}>
                    <i className="icon iconfont icon-camera-video"></i>
                </label>)
            }
        }

        const { showWebRTC } = this.state


        const content = () => {
            const radioStyle = {
                display: 'block',
                height: '30px',
                lineHeight: '30px',
            }

            const container = {
                height: '150px',
                overflowY: 'scroll'
            }
            let users = []
            let list = []
            let withInfoUsers = {}
            users = this.props.entities.roster.names || []
            withInfoUsers = this.props.entities.roster.byName
            users.forEach((item, index) => {
                list.push(
                    <Radio style={radioStyle} value={item} key={item}>
                        {withInfoUsers[item]?.info?.nickname || item}
                    </Radio>
                )
            })

            return (
                <div>
                    <div style={container}>
                        <Radio.Group onChange={this.onChange} value={this.state.checkedValue}>
                            {list}
                        </Radio.Group>
                    </div>
                    <Button onClick={this.sendIdCardMsg}>发送</Button>
                </div>
            )
        }

        return (
            <div className="x-chat">
                <div className="x-list-item x-chat-header">
                    {collapsed
                        ? <Icon
                            type="arrow-left"
                            onClick={back}
                            style={{
                                cursor: 'pointer',
                                fontSize: 20,
                                verticalAlign: 'middle',
                                marginRight: 10,
                                float: 'left',
                                lineHeight: '50px'
                            }}
                        />
                        : null}
                    <div className={`fl ${isShowDeleteGroupNotice ? 'notice' : ''}`}>

                        <span>{name}</span>
                        {isShowDeleteGroupNotice ? <span>该群仅供试用，72小时后将被删除</span> : ''}
                    </div>
                    <div className="fr">
                        <span style={{ color: '#8798a4', cursor: 'pointer' }}>
                            {selectTab === 'contact' || selectTab === 'stranger'
                                ? <Dropdown
                                    overlay={this.renderContactMenu(selectTab)}
                                    placement="bottomRight"
                                    trigger={['click']}
                                >
                                    <Icon type="ellipsis" />
                                </Dropdown>
                                : <Icon type="ellipsis" onClick={this.handleRightIconClick} />}
                        </span>
                    </div>
                </div>
                <div className="x-chat-content-tip">
                    本应用仅用于环信产品功能开发测试，请勿用于非法用途。任何涉及转账、汇款、裸聊、网恋、网购退款、投资理财等统统都是诈骗，请勿相信！
                </div>
                {
                    name === BOT_NAME && this.state.showBotRoles &&
                    (<div className="x-chat-content-tip" style={{display:'flex',justifyContent:'space-between'}}>
                        角色列表: {this.props.aiRoles.map((e) => {
                            return (<span key={e.description}>{e.id}: {e.description}</span>)
                        })}
                        <span onClick={()=> {this.setState({showBotRoles: false})}}><i className="iconfont icon-cross"/></span>
                    </div>)
                }
                <div className="x-chat-content" ref="x-chat-content" onScroll={this.handleScroll}>
                    {/* fixed bug of messageList.map(...) */}
                    {this.state.isLoaded && <div style={{ width: '150px', height: '30px', lineHeight: '30px', backgroundColor: '#888', color: '#fff', borderRadius: '15px', textAlign: 'center', margin: '10px auto' }}>{I18n.t('noMoreMessage')}</div>}
                    {_.map(messageList, (message, i) => {
                        if (i > 0) {
                            if (message.id != messageList[i - 1].id) {
                                return <ChatMessage key={message.id} canModifiedMsg={this.isCanModifiedMessage()} onReply={this.reply} gotoMessage={this.gotoMessage} fromNick={this.getFromNick(selectTab, userinfos, message)} onClickIdCard={this.onClickIdCard} onRecallMsg={this.recallMsg} onEditedMsg={this.editedMsg} {...message} />
                            }
                        } else {
                            return <ChatMessage key={message.id} canModifiedMsg={this.isCanModifiedMessage()} onReply={this.reply} gotoMessage={this.gotoMessage}  fromNick={this.getFromNick(selectTab, userinfos, message)} onClickIdCard={this.onClickIdCard} onRecallMsg={this.recallMsg} onEditedMsg={this.editedMsg} {...message} />
                        }
                    })}
                </div>
                {
                    entities.message.reply ? <ReplyMessage message={entities.message.reply} onCancel={() => this.props.replyMessage(null)} close></ReplyMessage> : ''
                }

                <div className="x-chat-footer">

                    <div className="x-list-item x-chat-ops">
                        {/* emoji */}
                        <div className="x-chat-ops-icon ib">
                            <ChatEmoji onClick={this.handleEmojiSelect} />
                        </div>
                        {/* image upload */}
                        <label
                            htmlFor="uploadImage"
                            className="x-chat-ops-icon ib"
                            onClick={() => this.image && this.image.focus() && this.image.click()}>
                            <i className="iconfont icon-picture" />
                            <input
                                id="uploadImage"
                                ref={node => (this.image = node)}
                                onChange={this.pictureChange}
                                type="file"
                                className="hide"
                            />
                        </label>
                        {/*  file upload*/}
                        <label
                            htmlFor="uploadFile"
                            className="x-chat-ops-icon ib"
                            onClick={() => this.file && this.file.focus() && this.file.click()}>
                            <i className="icon iconfont icon-file-empty" />
                            <input
                                id="uploadFile"
                                ref={node => (this.file = node)}
                                onChange={this.fileChange}
                                type="file"
                                className="hide"
                            />
                        </label>
                        {/* webrtc video && audio && 发送音频 */}
                        {webrtcButtons}
                        {WebIM.config.isWebRTC && <RecordAudio match={match} />}
                        {/* clear */}
                        <label htmlFor="clearMessage" className="x-chat-ops-icon ib" onClick={this.onClearMessage}>
                            <i className="icon iconfont icon-trash"></i>
                        </label>


                        <Popover
                            content={content()}
                            title=""
                            trigger="click"
                            visible={this.state.visible}
                            onVisibleChange={this.handleHoverChange}
                        >
                            <Icon type="idcard" style={{ padding: '0 15px' }} className="icon iconfont icon-trash" />
                        </Popover>
                    </div>
                    <div className="x-list-item x-chat-send">
                        {chatType[selectTab] === 'groupchat' ? (
                            <>
                            <GroupInput 
                                value={this.state.value}
                                handleChange={this.handleChange}
                                handleSend={this.handleSend}
                                getGroupMember={this.getGroupMember}
                                setMentionList={this.setMentionList}
                                ref={(node) => (this.input = node)}
                            /><div>
                                    <i
                                        className="fontello icon-paper-plane"
                                        onClick={() => {
                                            this.handleSend({ charCode: 13 })
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </div></>
                        ) : (
                            <><ChatInput
                                value={this.state.value}
                                handleChange={this.handleChange}
                                handleSend={this.handleSend}
                                ref={(node) => (this.input = node)}
                            /><div>
                                <i
                                    className="fontello icon-paper-plane"
                                    onClick={() => {
                                        this.handleSend({ charCode: 13 })
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div></>
                        )}
                        {/*<TextArea rows={2} />*/}
                    </div>
                </div>
                {/* <WebRTCModal collapsed={collapsed} visible={showWebRTC} /> */}
                <ModalComponent
                    closable={false}
                    width={460}
                    /* title={I18n.t("addAFriend")} */
                    // title={'选择成员'}
                    visible={inviteModal === true}
                    maskClosable={false}
                    component={AddAVMemberModal}
                    onModalClose={this.handleModalClose}
                />

                <ModalComponent
                    width={360}
                    title="个人名片"
                    visible={this.state.showUserInfoMoadl}
                    userInfos={this.userInfo}
                    showEdit={this.showEdit}
                    component={UserInfoModal}
                    onModalClose={this.handleInfoModalClose}
                />

                <ModalComponent 
                    width={360}
                    title="机器人命令列表"
                    isGroup={chatType[selectTab] === 'groupchat'}
                    visible={this.state.showBotModal}
                    component={CommandHelpModal}
                    onModalClose={this.handleHelpModalClose}
                />
            </div >
        )
    }
}

export default connect(
    (state, props) => ({
        messageList: getTabMessages(state, props).TabMessageArray,
        messageListByMid: state.entities.message.byMid,
        inviteModal: state.callVideo.inviteModal,
        callStatus: state.callVideo.callStatus,
        entities: state.entities,
        reply: state.reply,
        aiRoles: state.entities.aiBot.roleList,
        userRole: state.entities.aiBot.selectedRole,
        state: state
    }),
    dispatch => ({
        switchRightSider: ({ rightSiderOffset }) => dispatch(GroupActions.switchRightSider({ rightSiderOffset })),
        setGroupMemberAttr: (resp) => dispatch(GroupActions.setGroupMemberAttr(resp)),
        sendTxtMessage: (chatType, id, message) => dispatch(MessageActions.sendTxtMessage(chatType, id, message)),
        deleteMessage: (id) => dispatch(MessageActions.deleteMessage(id, true)),
        editedMessage: (id, message) => dispatch(MessageActions.editedMessage(id, message)),
        sendImgMessage: (chatType, id, message, source, callback) => dispatch(MessageActions.sendImgMessage(chatType, id, message, source, callback)),
        sendFileMessage: (chatType, id, message, source, callback) => dispatch(MessageActions.sendFileMessage(chatType, id, message, source, callback)),
        sendCustomMsg: (chatType, id, message) => dispatch(MessageActions.sendCustomMsg(chatType, id, message)),
        clearMessage: (chatType, id) => dispatch(MessageActions.clearMessage(chatType, id)),
        listGroupMemberAsync: opt => dispatch(GroupMemberActions.listGroupMemberAsync(opt)),
        getMutedAsync: groupId => dispatch(GroupMemberActions.getMutedAsync(groupId)),
        getGroupAdminAsync: groupId => dispatch(GroupMemberActions.getGroupAdminAsync(groupId)),
        removeContact: id => dispatch(RosterActions.removeContact(id)),
        addContact: id => dispatch(RosterActions.addContact(id)),
        getUserInfo: id => dispatch(RosterActions.getUserInfo(id)),
        deleteStranger: id => dispatch(StrangerActions.deleteStranger(id)),
        doAddBlacklist: id => dispatch(BlacklistActions.doAddBlacklist(id)),
        fetchMessage: (id, chatType, offset, cb) => dispatch(MessageActions.fetchMessage(id, chatType, offset, cb)),
        showInviteModal: () => dispatch(VideoCallActions.showInviteModal()),
        closeInviteModal: () => dispatch(VideoCallActions.closeInviteModal()),
        updateConfr: (msg) => dispatch(VideoCallActions.updateConfr(msg)),
        setCallStatus: (status) => dispatch(VideoCallActions.setCallStatus(status)),
        cancelCall: (to) => dispatch(VideoCallActions.cancelCall(to)),
        setGid: (gid) => dispatch(VideoCallActions.setGid(gid)),
        hangup: () => dispatch(VideoCallActions.hangup()),
        replyMessage: (message) => dispatch(MessageActions.replyMessage(message)),
        updateRoles: () => dispatch(AIBotActions.getSupportRoles()),
        setRole: (role) => dispatch(AIBotActions.setRole(role))
    })
)(Chat)
