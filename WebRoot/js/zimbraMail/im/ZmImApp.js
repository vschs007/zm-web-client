/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * Zimbra Collaboration Suite Web Client
 * Copyright (C) 2005, 2006, 2007 Zimbra, Inc.
 *
 * The contents of this file are subject to the Yahoo! Public License
 * Version 1.0 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 *
 * ***** END LICENSE BLOCK *****
 */

ZmImApp = function(container) {

	ZmApp.call(this, ZmApp.IM, container);

	// IM is enabled, so show Chats folder
	delete ZmFolder.HIDE_ID[ZmOrganizer.ID_CHATS];
	this._active = false;
	ZmImApp.INSTANCE = this;
};

// Organizer and item-related constants
ZmEvent.S_CHAT        			= "CHAT";
ZmEvent.S_ROSTER				= "ROSTER";
ZmEvent.S_ROSTER_ITEM			= "ROSTER ITEM";
ZmEvent.S_ROSTER_TREE_ITEM		= "ROSTER TREE ITEM";
ZmEvent.S_ROSTER_TREE_GROUP		= "ROSTER TREE GROUP";
ZmItem.CHAT						= ZmEvent.S_CHAT;
ZmItem.ROSTER_ITEM				= ZmEvent.S_ROSTER_ITEM;
ZmOrganizer.ROSTER_TREE_ITEM	= ZmEvent.S_ROSTER_TREE_ITEM;
ZmOrganizer.ROSTER_TREE_GROUP	= ZmEvent.S_ROSTER_TREE_GROUP;

ZmItem.F_PRESENCE = "PRESENCE";
ZmItem.F_PRESENCE_CELL = "PRESENCE_cell";

// App-related constants
ZmApp.IM					= "IM";
ZmApp.CLASS[ZmApp.IM]		= "ZmImApp";
ZmApp.SETTING[ZmApp.IM]		= ZmSetting.IM_ENABLED;
ZmApp.LOAD_SORT[ZmApp.IM]	= 70;
ZmApp.QS_ARG[ZmApp.IM]		= "chat";

ZmImApp.prototype = new ZmApp;
ZmImApp.prototype.constructor = ZmImApp;

ZmImApp.loggedIn = function() {
        return ZmImApp.INSTANCE
                && ( appCtxt.get(ZmSetting.IM_PREF_AUTO_LOGIN) ||
                     ZmImApp.INSTANCE._roster );
};

ZmImApp.prototype.toString =
function() {
	return "ZmImApp";
};

// Construction

ZmImApp.prototype._defineAPI =
function() {
	AjxDispatcher.registerMethod("GetRoster",
                                     "IMCore",
                                     new AjxCallback(this, this.getRoster));

	AjxDispatcher.registerMethod("GetChatListController",
                                     [ "IMCore", "IM" ],
                                     new AjxCallback(this, this.getChatListController));
};

ZmImApp.prototype._registerOperations =
function() {
	ZmOperation.registerOp("IM_NEW_CHAT"	       , { textKey: "imNewChat", image: "ImFree2Chat" });
	ZmOperation.registerOp("IM_NEW_GROUP_CHAT"     , { textKey: "imNewGroupChat", image: "ImFree2Chat" });
	ZmOperation.registerOp("IM_PRESENCE_AWAY"      , { textKey: "imStatusAway", image: "ImAway" });
	ZmOperation.registerOp("IM_PRESENCE_CHAT"      , { textKey: "imStatusChat", image: "ImFree2Chat" });
	ZmOperation.registerOp("IM_PRESENCE_DND"       , { textKey: "imStatusDND", image: "ImDnd" });
	ZmOperation.registerOp("IM_PRESENCE_INVISIBLE" , { textKey: "imStatusInvisible", image: "ImInvisible" });
	ZmOperation.registerOp("IM_PRESENCE_MENU"      , { textKey: "imPresence" }, null, ZmImApp.addImPresenceMenu );
	ZmOperation.registerOp("IM_PRESENCE_OFFLINE"   , { textKey: "imStatusOffline", image: "Offline" });
	ZmOperation.registerOp("IM_PRESENCE_ONLINE"    , { textKey: "imStatusOnline", image: "ImAvailable" });
	ZmOperation.registerOp("IM_PRESENCE_XA"	       , { textKey: "imStatusExtAway", image: "ImExtendedAway" });
	ZmOperation.registerOp("NEW_ROSTER_ITEM"       , { textKey: "newRosterItem", image: "ImBuddy" });
	ZmOperation.registerOp("IM_CREATE_CONTACT"     , { textKey: "addToNewContact", image: "NewContact" });
	ZmOperation.registerOp("IM_ADD_TO_CONTACT"     , { textKey: "addToExistingContact", image: "Edit" });
	ZmOperation.registerOp("IM_EDIT_CONTACT"       , { textKey: "editContact", image: "Edit" });
	ZmOperation.registerOp("IM_GATEWAY_LOGIN"      , { textKey: "imGatewayLogin", image: "ExternalLink" });
	ZmOperation.registerOp("IM_TOGGLE_OFFLINE"     , { textKey: "imToggleOffline" });
        ZmOperation.registerOp("IM_TOGGLE_BLOCKED"     , { textKey: "imToggleBlocked" });
        ZmOperation.registerOp("IM_FLOATING_LIST"      , { textKey: "imFloatingBuddyList", image: "ImGroup" });

        ZmOperation.registerOp("IM_SORT_BY_PRESENCE"   , { textKey: "imSortListByPresence" });
        ZmOperation.registerOp("IM_SORT_BY_NAME"       , { textKey: "imSortListByName" });

	ZmOperation.registerOp("IM_PRESENCE_CUSTOM_MSG"		, { textKey: "imCustomStatusMsg", image: "ImFree2Chat"});

        ZmOperation.registerOp("IM_BLOCK_BUDDY" , { textKey: "imBlock", image: "BlockUser" });
        ZmOperation.registerOp("IM_UNBLOCK_BUDDY" , { textKey: "imUnblock", image: "AllowUser" });
};

ZmImApp.prototype._registerItems =
function() {
	ZmItem.registerItem(ZmItem.CHAT,
			    { app	 : ZmApp.IM,
			      nameKey	 : "chat",
			      icon	 : "ImStartChat",
			      soapCmd	 : "ItemAction",
			      itemClass	 : "ZmChat",
			      node	 : "chat",
			      organizer	 : ZmOrganizer.ROSTER,
			      searchType : "chat"
			    });
};

ZmImApp.prototype._registerApp =
function() {
	var newItemOps = {};
	newItemOps[ZmOperation.IM_NEW_CHAT] = "chat";
        newItemOps[ZmOperation.IM_FLOATING_LIST] = "im_floating_list";
	ZmApp.registerApp(ZmApp.IM,
			  { mainPkg	      : "IM",
			    nameKey	      : "imAppTitle",
			    icon	      : "ImStartChat",
			    chooserTooltipKey : "goToIm",
			    defaultSearch     : ZmSearchToolBar.FOR_MAIL_MI,
			    gotoActionCode    : ZmKeyMap.GOTO_IM,
			    chooserSort	      : 40,
			    defaultSort	      : 50,
			    newItemOps        : newItemOps
			  });
};

ZmImApp.prototype._registerSettings = function(settings) {
	settings = settings || appCtxt.getSettings();

    settings.registerSetting("IM_PREF_NOTIFY_SOUNDS",{
            name        :   "zimbraPrefIMSoundsEnabled", 
            type        :   ZmSetting.T_PREF,
            dataType    :   ZmSetting.D_BOOLEAN,
            defaultValue:   true
    });

    settings.registerSetting("IM_PREF_INSTANT_NOTIFY",
				 { name         : "zimbraPrefIMInstantNotify",
				   type         : ZmSetting.T_PREF,
				   dataType     : ZmSetting.D_BOOLEAN,
				   defaultValue : true });

        settings.registerSetting("IM_PREF_AUTO_LOGIN",
				 { name         : "zimbraPrefIMAutoLogin",
                                   type         : ZmSetting.T_PREF,
                                   dataType     : ZmSetting.D_BOOLEAN,
				   defaultValue : false
				 });

        settings.registerSetting("IM_PREF_FLASH_ICON",
				 { name         : "zimbraPrefIMFlashIcon",
                                   type         : ZmSetting.T_PREF,
                                   dataType     : ZmSetting.D_BOOLEAN,
				   defaultValue : true
				 });

        settings.registerSetting("IM_PREF_NOTIFY_PRESENCE",
				 { name         : "zimbraPrefIMNotifyPresence",
                                   type         : ZmSetting.T_PREF,
                                   dataType     : ZmSetting.D_BOOLEAN,
				   defaultValue : true
				 });

        settings.registerSetting("IM_PREF_NOTIFY_STATUS",
				 { name         : "zimbraPrefIMNotifyStatus",
                                   type         : ZmSetting.T_PREF,
                                   dataType     : ZmSetting.D_BOOLEAN,
				   defaultValue : true
				 });

	settings.registerSetting("IM_PREF_LOGCHATS_ENABLED",
			         { name		: "zimbraPrefIMLogChats",
				   type		: ZmSetting.T_PREF,
				   dataType	: ZmSetting.D_BOOLEAN,
				   defaultValue	: true
			         });

        settings.registerSetting("IM_PREF_REPORT_IDLE",
                                 { name         : "zimbraPrefIMReportIdle",
                                   type         : ZmSetting.T_PREF,
                                   dataType     : ZmSetting.D_BOOLEAN,
                                   defaultValue : true
                                 });

        settings.registerSetting("IM_PREF_IDLE_TIMEOUT",
                                 { name         : "zimbraPrefIMIdleTimeout",
                                   type         : ZmSetting.T_PREF,
                                   dataType     : ZmSetting.D_INT,
                                   defaultValue : 10
                                 });

        settings.registerSetting("IM_PREF_IDLE_STATUS",
                                 { name         : "zimbraPrefIMIdleStatus",
                                   type         : ZmSetting.T_PREF,
                                   dataType     : ZmSetting.D_STRING,
                                   defaultValue : "xa"
                                 });

        var listener = new AjxListener(this, this._onSettingChange);
	settings.getSetting(ZmSetting.IM_PREF_INSTANT_NOTIFY).addChangeListener(listener);
        settings.getSetting(ZmSetting.IM_PREF_REPORT_IDLE).addChangeListener(listener);
        settings.getSetting(ZmSetting.IM_PREF_IDLE_TIMEOUT).addChangeListener(listener);
};

ZmImApp.prototype._registerPrefs = function() {
	var sections = {
		IM: {
			title: ZmMsg.im,
			templateId: "prefs.Pages#IM",
			priority: 90,
			precondition: ZmSetting.IM_ENABLED,
			prefs: [
				ZmSetting.IM_PREF_INSTANT_NOTIFY,
				ZmSetting.IM_PREF_AUTO_LOGIN,
				ZmSetting.IM_PREF_FLASH_ICON,
				ZmSetting.IM_PREF_NOTIFY_PRESENCE,
				ZmSetting.IM_PREF_NOTIFY_STATUS,
				ZmSetting.IM_PREF_LOGCHATS_ENABLED,

                ZmSetting.IM_PREF_REPORT_IDLE,
                ZmSetting.IM_PREF_IDLE_TIMEOUT,
                ZmSetting.IM_PREF_IDLE_STATUS,
                ZmSetting.IM_PREF_NOTIFY_SOUNDS    
            ]
		}
	};
	for (var id in sections) {
		ZmPref.registerPrefSection(id, sections[id]);
	}

    ZmPref.registerPref("IM_PREF_NOTIFY_SOUNDS",{
            displayName     :   ZmMsg.imPrefNotifySounds,
            displayContainer:   ZmPref.TYPE_CHECKBOX
    });

    ZmPref.registerPref("IM_PREF_INSTANT_NOTIFY",
			    { displayName      : ZmMsg.imPrefInstantNotify,
			      displayContainer : ZmPref.TYPE_CHECKBOX,
			      precondition     : ZmSetting.INSTANT_NOTIFY });

	ZmPref.registerPref("IM_PREF_AUTO_LOGIN",
			    { displayName      : ZmMsg.imPrefAutoLogin,
			      displayContainer : ZmPref.TYPE_CHECKBOX });

	ZmPref.registerPref("IM_PREF_FLASH_ICON",
			    { displayName      : ZmMsg.imPrefFlashIcon,
			      displayContainer : ZmPref.TYPE_CHECKBOX });

	ZmPref.registerPref("IM_PREF_NOTIFY_PRESENCE",
			    { displayName      : ZmMsg.imPrefNotifyPresence,
			      displayContainer : ZmPref.TYPE_CHECKBOX });

	ZmPref.registerPref("IM_PREF_NOTIFY_STATUS",
			    { displayName      : ZmMsg.imPrefNotifyStatus,
			      displayContainer : ZmPref.TYPE_CHECKBOX });

	ZmPref.registerPref("IM_PREF_LOGCHATS_ENABLED",
                            { displayName      : ZmMsg.imPrefLogChats,
			      displayContainer : ZmPref.TYPE_CHECKBOX });

        ZmPref.registerPref("IM_PREF_REPORT_IDLE",
                            { displayName      : ZmMsg.imPrefReportIdle,
                              displayContainer : ZmPref.TYPE_CHECKBOX });

        ZmPref.registerPref("IM_PREF_IDLE_TIMEOUT",
                            { displayName      : ZmMsg.imPrefIdleTimeout,
                              displayContainer : ZmPref.TYPE_SELECT,
                              displayOptions   : [ ZmMsg.imPrefIdleTimeoutMinutes,
                                                   ZmMsg.imPrefIdleTimeoutMinutes,
                                                   ZmMsg.imPrefIdleTimeoutMinutes,
                                                   ZmMsg.imPrefIdleTimeoutMinutes,
                                                   ZmMsg.imPrefIdleTimeoutMinutes,
                                                   ZmMsg.imPrefIdleTimeoutMinutes
                                                 ],
                              options          : [ 1, 5, 10, 20, 30, 60 ],
                              precondition     : ZmSetting.IM_PREF_REPORT_IDLE });

        ZmPref.registerPref("IM_PREF_IDLE_STATUS",
                            { displayName      : ZmMsg.imPrefIdleStatus,
                              displayContainer : ZmPref.TYPE_SELECT,
                              displayOptions   : [ ZmMsg.imStatusAway,
                                                   ZmMsg.imStatusExtAway,
                                                   // ZmMsg.imStatusInvisible, // no support in server for now
                                                   ZmMsg.imStatusOffline ],
                              options          : [ "away",
                                                   "xa",
                                                   // "invisible",
                                                   "offline" ],
                              precondition     : ZmSetting.IM_PREF_REPORT_IDLE
                            });

};

ZmImApp.prototype._setupCurrentAppToolbar =
function() {
	var callback = new AjxCallback(this,function(ev){
		this.getRosterTreeController()._newRosterItemListener(ev);
	});
	ZmCurrentAppToolBar.registerApp(this.getName(), ZmOperation.NEW_ROSTER_ITEM,null,callback);
};

ZmImApp.prototype._onSettingChange = function(ev) {
	if (ev.type != ZmEvent.S_SETTING) return;

	var id = ev.source.id;
        var val = appCtxt.get(id);

        if (id == ZmSetting.IM_PREF_INSTANT_NOTIFY && appCtxt.get(ZmSetting.INSTANT_NOTIFY)) {

		appCtxt.getAppController().setInstantNotify(val);

        } else if (this._roster && id == ZmSetting.IM_PREF_REPORT_IDLE) {

                if (!val)
                        this._roster._idleTimer.kill();
                else
                        this._roster._idleTimer.resurrect(appCtxt.get(ZmSetting.IM_PREF_IDLE_TIMEOUT));

        } else if (this._roster && id == ZmSetting.IM_PREF_IDLE_TIMEOUT) {

                this._roster._idleTimer.timeout = parseInt(val) * 60 * 1000;

        }
};

ZmImApp.prototype.refresh =
function() {
        if (this._roster) {
                // better not call getRoster() here since we don't
                // want to reinit. IM if it wasn't already.
	        this._roster.refresh();
        }
};

ZmImApp.prototype.handleOp = function(op) {
	switch (op) {
	    case ZmOperation.IM_NEW_CHAT:
		this.prepareVisuals(); // ... and create views, if not yet done
		this.getRosterTreeController()._imNewChatListener();
		break;
            case ZmOperation.IM_FLOATING_LIST:
                this.prepareVisuals();
                this.getRosterTreeController()._imFloatingListListener();
                break;
	}
};

ZmImApp.prototype.postNotify =
function(notify) {
	if (notify.im) {
                AjxDispatcher.run("GetRoster").pushNotification(notify.im);
	}
};

ZmImApp.prototype.startup =
function(result) {
	if (appCtxt.get(ZmSetting.IM_PREF_AUTO_LOGIN)) {
		// Do the auto login after a short delay. I chose 1000ms because that means
		// im login will after zimlets are loaded.
		AjxTimedAction.scheduleAction(new AjxTimedAction(this, this._autoLogin), 1000);
	}
};

ZmImApp.prototype._autoLogin =
function() {
	var callback = new AjxCallback(this, this._postLoadAutoLogin);
	AjxDispatcher.require([ "IMCore", "IM" ], true, callback);
};

ZmImApp.prototype._postLoadAutoLogin =
function() {
	var callback = new AjxCallback(this, this._backgroundCreateCallback);
	ZmRoster.createInBackground(callback);
};

ZmImApp.prototype._backgroundCreateCallback =
function(roster) {
	if (!this._roster) { // Roster could have conceivably been set by getRoster...don't overwrite that one.
		this._setRoster(roster);
		this._roster.reload();		
	}
};

ZmImApp.prototype.launch = function(params, callback) {
	var loadCallback = new AjxCallback(this, this._handleLoadLaunch, [callback]);
	AjxDispatcher.require([ "IMCore", "IM" ], true, loadCallback, null, true);
};

ZmImApp.prototype._handleLoadLaunch = function(callback) {
	var clc = this.getChatListController();
	clc.show();
	if (callback) {
		callback.run();
	}
};

ZmImApp.prototype.activate =
function(active) {
	if (active) {
		this.stopFlashingIcon();
		if (this._toast && this._toast.isPoppedUp()) {
			this._toast.transition();
		}
	}
	return ZmApp.prototype.activate.call(this, active);
};

ZmImApp.prototype.getRosterTreeController = function() {
	if (!this._rosterTreeController) {
		this._rosterTreeController = new ZmRosterTreeController();
	}
	return this._rosterTreeController;
};

ZmImApp.prototype.isActive = function() {
	return this._active;
};

ZmImApp.prototype.getChatListController =
function() {
	if (!this._chatListController) {
		this._chatListController = new ZmChatListController(this._container, this);
	}
	return this._chatListController;
};

ZmImApp.prototype.getRoster =
function() {
	if (!this._roster) {
		this._setRoster(new ZmRoster(this));
		this._roster.refresh();
	}
	return this._roster;
};

ZmImApp.prototype._setRoster =
function(roster) {
	this._roster = roster;

	// Turn on instant notifications after a short delay, to prevent
	// a flurry of no-op requests on startup.
	if (appCtxt.get(ZmSetting.INSTANT_NOTIFY) && appCtxt.get(ZmSetting.IM_PREF_INSTANT_NOTIFY)) {
		var action = new AjxTimedAction(this, this.requestInstantNotify);
		AjxTimedAction.scheduleAction(action, 4000);
	}
};

ZmImApp.prototype.requestInstantNotify =
function(roster) {
	if (appCtxt.get(ZmSetting.INSTANT_NOTIFY) && appCtxt.get(ZmSetting.IM_PREF_INSTANT_NOTIFY)) {
		appCtxt.getAppController().setInstantNotify(true);
	}
};

ZmImApp.prototype.getAutoCompleteGroups =
function() {
	return new ZmRosterTreeGroups(this.getRoster());
};

ZmImApp.prototype.startFlashingIcon = function() {
	if (appCtxt.get(ZmSetting.IM_PREF_FLASH_ICON)) {
		appCtxt.getAppController().getAppChooserButton("IM").startFlashing();
	}
};

ZmImApp.prototype.stopFlashingIcon = function() {
	if (appCtxt.get(ZmSetting.IM_PREF_FLASH_ICON)) {
		appCtxt.getAppController().getAppChooserButton("IM").stopFlashing();
	}
};

ZmImApp.getImPresenceMenuOps = function() {

	var list = [ ZmOperation.IM_PRESENCE_OFFLINE,
		     ZmOperation.IM_PRESENCE_ONLINE,
		     ZmOperation.IM_PRESENCE_CHAT,
                     ZmOperation.IM_PRESENCE_DND,
		     ZmOperation.IM_PRESENCE_AWAY,
		     ZmOperation.IM_PRESENCE_XA,
                     ZmOperation.IM_PRESENCE_INVISIBLE,
                     ZmOperation.SEP,
                     ZmOperation.IM_PRESENCE_CUSTOM_MSG
		   ];

	return list;
};

ZmImApp.addImPresenceMenu =
function(parent) {

	var list = ZmImApp.getImPresenceMenuOps();

	var menu = new ZmPopupMenu(parent);

	for (var i = 0; i < list.length; i++) {
		var op = list[i];
                if (op == ZmOperation.SEP)
                        new DwtMenuItem({parent:menu, style:DwtMenuItem.SEPARATOR_STYLE});
                else {
		        var mi = menu.createMenuItem(op, { image : ZmOperation.getProp(op, "image"),
						           text	 : ZmMsg[ZmOperation.getProp(op, "textKey")],
						           style : DwtMenuItem.RADIO_STYLE
						         });
		        mi.setData(ZmOperation.MENUITEM_ID, op);
		        mi.setData(ZmOperation.KEY_ID, op);
		        if (op == ZmOperation.IM_PRESENCE_OFFLINE)
			        mi.setChecked(true, true);
                }
	}

	parent.setMenu(menu, false, DwtMenuItem.RADIO_STYLE);
	return menu;
};

ZmImApp.prototype.prepareVisuals = function() {
	if (!this._haveVisuals) {
                AjxDispatcher.require([ "IMCore", "IM" ], false, new AjxCallback(this, function(){
		        this.getChatListController().prepareVisuals();
                        this._haveVisuals = true;
                }, null, true));
	}
};

ZmImApp.prototype.getOverviewPanelContent = function() {
	if (!this._imOvw)
		this._imOvw = new ZmImOverview(this._container);
	return this._imOvw;
};

ZmImApp.INCOMING_MSG_NOTIFICATION = "incoming";
ZmImApp.prototype.playAlert = function(type){
    switch(type){
        case ZmImApp.INCOMING_MSG_NOTIFICATION:
            appCtxt.getSimpleSoundPlayer().play(appContextPath+"/public/sounds/im/alert.wav");
            break;
    }
};

ZmImApp.prototype.showToast = function(chat, chatMessage){
	if (!this._toast) {
		this._toast = new ZmImToast(appCtxt.getAppController().statusView);
	}
	if (this._toast.isPoppedUp()) {
		return;
	}
	var msgArgs = {
		body: chatMessage.body,
		from: chat.getDisplayName(chatMessage.from, false)
	}
	for (var i in msgArgs) {
		msgArgs[i] = AjxStringUtil.htmlEncode(AjxStringUtil.clipByLength(msgArgs[i], 30));
	}
	var args = {
		msg: AjxTemplate.expand("im.Chat#ToastText", msgArgs),
		level: ZmStatusView.LEVEL_INFO,
		transitions: [ ZmToast.FADE_IN, ZmImToast.REMAIN, ZmToast.PAUSE, ZmToast.FADE_OUT ],
		toast: this._toast
	};
	appCtxt.setStatusMsg(args);
};
