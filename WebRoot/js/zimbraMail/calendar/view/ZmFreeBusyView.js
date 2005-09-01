/*
 * ***** BEGIN LICENSE BLOCK *****
 * Version: ZPL 1.1
 * 
 * The contents of this file are subject to the Zimbra Public License
 * Version 1.1 ("License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.zimbra.com/license
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is: Zimbra Collaboration Suite.
 * 
 * The Initial Developer of the Original Code is Zimbra, Inc.
 * Portions created by Zimbra are Copyright (C) 2005 Zimbra, Inc.
 * All Rights Reserved.
 * 
 * Contributor(s):
 * 
 * ***** END LICENSE BLOCK *****
 */

/**
 * the data behind this is a user's schedule.
 *
 * Each row in the table should represent a date range of a user's 
 * schedule. 
 *
 * NOTES:
 * Not sure if I should use a DwtListView here, since there is no
 * list to display, and since the layout is very static. Hmm ...
 *
 * This needs to use an ZmAppt as it's model data.... Maybe ZmAppt
 * needs to handle the fetch of the data, and the creation of the busy blocks.
 */
function ZmFreeBusyView (parent, userSchedules, start, end, appt, className, posStyle) {
	var clsName = className? className: "ZmFreeBusyView";
	var pStyle = posStyle? posStyle: DwtControl.RELATIVE_STYLE;
	DwtComposite.call(this, parent, clsName, pStyle);
	this.userSchedules = userSchedules? userSchedules: new Array();
	// FOR TESTING
	//this.userSchedules = this._createDummySchedule();
	this.startDate = start;
	//this.endDate = end;
	this.endDate = new Date(start.getTime());
	AjxDateUtil.roll(this.endDate, AjxDateUtil.DAY, 1);
	// this has to come from an appointment
	this._appt = appt;
	this._currentAppt = new ZmFreeBusyAppointment(appt.getStartDate(), appt.getEndDate(), this);
	//this._startApptDate = appt.getStartDate();
	//this._endApptDate = appt.getEndDate();
	// If this uses the list view, we will have to
	this._dummyBlock = new ZmBusyBlock();
	this._selectionManager = new AjxSelectionManager(this);
	this._aggregatedSchedule = new Array();
	this.enable();
	this._appCtxt = this.shell.getData(ZmAppCtxt.LABEL);
	this.render();
}

ZmFreeBusyView.prototype = new DwtComposite;
ZmFreeBusyView.prototype.constructor = ZmFreeBusyView;

ZmFreeBusyView.ADD_NAME_MSG = "Click to add a name";

ZmFreeBusyView.PAGINATE_FORWARD = 1;
ZmFreeBusyView.PAGINATE_BACK = 2;

ZmFreeBusyView.MAX_DURATION_MILLIS = 86400000;
ZmFreeBusyView.BLOCK_TYPE_TO_CLASSNAME = {
	b: "busy",
	f: "free",
	t: "tentative",
	o: "ooo",
	n: "n_a"
};

ZmFreeBusyView.TYPE_RANKING = {
	'n_a': 0,
	'free': 1,
	'tentative': 2,
	'busy': 3,
	'ooo': 4
};

ZmFreeBusyView.CLASS_TO_HIGHLIGHTEDCLASS = {
	'free': 'freeHighlighted',
	'tentative': 'tentativeHighlighted',
	'busy': 'busyHighlighted',
	'ooo': 'oooHighlighted',
	'n_a': 'n_aHighlighted'
};

ZmFreeBusyView.HIGHLIGHTEDCLASS_TO_CLASS = {
	'freeHighlighted': 	'free',
	'tentativeHighlighted': 'tentative',
	'busyHighlighted': 'busy',
	'oooHighlighted': 'ooo',
	'n_aHighlighted': 'n_a'
};

ZmFreeBusyView.ADDR_SELECTED = "addrSelected";
ZmFreeBusyView.ADDRESS_CELL = "addressCell";
ZmFreeBusyView.ADDRESS_INPUT_CELL = "addressInputCell";
ZmFreeBusyView.ADDRESS_INPUT_EMPTY_CELL = "addressInputEmptyCell";

ZmFreeBusyView.hourMap = {
	0:"12", 1:"1", 2:"2", 3:"3", 4:"4", 5:"5",
	6:"6", 7:"7", 8:"8", 9:"9", 10:"10", 11:"11",
	12:"12", 13:"1", 14:"2", 15:"3", 16:"4",17:"5",
	18:"6", 19:"7", 20:"8", 21:"9", 22:"10", 23:"11"
};


ZmFreeBusyView.prototype._createDummySchedule = function () {

	var a = new ZmUserSchedule();
	a.blocks = [
			   new ZmBusyBlock(1115742500000, 1115746200000, "b"), // 9-10:30
			   new ZmBusyBlock(1115748000000, 1115751600000, "b"), // 11-12
			   new ZmBusyBlock(1115755200000, 1115762400000, "b") // 13-15
			   ];
	a.id ="user1@db682461.zimbra.com"
	var b = new ZmUserSchedule ();
	b.blocks =[
			   new ZmBusyBlock(1115740800000, 1115744400000, "b"), // 9-10
			   new ZmBusyBlock(1115748000000, 1115751600000, "b"), // 11-12
			   new ZmBusyBlock(1115755200000, 1115762400000, "b") // 13-15
			   ];
	b.id = "user2@db682461.zimbra.com"

	var schedule = [a,b];
	
	return schedule;
};

ZmFreeBusyView.ROW_HEIGHT = 21;
ZmFreeBusyView.ID_PREFIX="LFBV_";

// ========================================================================
// main render methods
// ========================================================================

/**
 * Assume that the free busy request has been made before render has 
 * been called. That means that we can render the table in one pass, 
 * using colspan for the rendering of scheduled items.
 */
ZmFreeBusyView.prototype.render = function () {
	//DBG.showTiming(true,"Start Render");
	var buf = new AjxBuffer();
	var i = 0;
	var x = 0;
	//var containerHeight = this.parent.getH() - 88;
	var containerHeight = 240;
	var rowsToSubtract = 2;
	if (AjxEnv.isIE) rowsToSubtract = 2;
	this._totalRows = (Math.round(containerHeight/ZmFreeBusyView.ROW_HEIGHT) ) - rowsToSubtract;
	this._origTotalRows = this._totalRows;
	this._startDateId = Dwt.getNextId();
	this._startTimeHrId = Dwt.getNextId();
	this._startTimeMinId = Dwt.getNextId();
	this._startTimeAmPmId = Dwt.getNextId();
	this._endDateId = Dwt.getNextId();
	this._endTimeHrId = Dwt.getNextId();
	this._endTimeMinId = Dwt.getNextId();
	this._endTimeAmPmId = Dwt.getNextId();
	this._rangeDateId = Dwt.getNextId();
	this._scheduleContainerId = Dwt.getNextId();
	buf.append(
			   "<div class='ZmFreeBusyView_headers'><table>",
			   "<colgroup><col width=100><col width=85 ><col width=50><col width=50><col width=55></colgroup>",
			   "<tbody><tr>",
			   "<td>Meeting start time:</td><td id='", this._startDateId, "'></td>",
			   "<td id='",this._startTimeHrId, "'></td>",
			   "<td id='",this._startTimeMinId, "'></td>",
			   "<td id='",this._startTimeAmPmId, "'></td>",
			   "</tr>",
			   "<tr><td>Meeting end time:</td><td id='",this._endDateId, "'></td>",
			   "<td id='",this._endTimeHrId, "'></td>",
			   "<td id='",this._endTimeMinId, "'></td>",
			   "<td id='",this._endTimeAmPmId, "'></td>",
			   "</tr></table></div>",

			   "<div class='ZmFreeBusyView_key'>",
			   AjxImg.getImageHtml(ZmImg.CAL_FB_KEY),
			   "</div>",

			   "<div class='ZmFreeBusyView_dateString' id='", this._rangeDateId, "'>", 
			   (AjxDateUtil.getTimeStr(this.startDate,"%M %d, %Y")) ,"</div>",

			   //"<tr style='height:", containerHeight, ";'><td colspan=2 class='ZmFreeBusyView_scheduleCol' id='", 
			   "<div class='ZmFreeBusyView_scheduleCol' id='",
			   this._scheduleContainerId, "'>");

	this._renderSchedules(buf, containerHeight);
	// write the div with the invitees

	//buf.append("</td></tr></table>");
	buf.append("</div>");
	this.setContent(buf.toString());

	// create autocomplete list
	this._createAutoCompleteWidget();

	for ( var i = 0 ; i < this.userSchedules.length; ++i) {
		this._updateRow(this.userSchedules[i], i + 3);
// 		this._updateAddressRow(this.userSchedules[i], i + 3);
// 		this._updateScheduleRow(this.userSchedules[i], i + 3);
		this._updateAggregatedSchedule(this.userSchedules[i].blocks);
	}
	this._updateEmptyRow(i + 3);

	this._writeAggregatedRow();

	var datePickerCreation = function () {
		this._createDatePicker(this._currentAppt.getStartDate());
		this._createDatePicker(this._currentAppt.getEndDate(), true);

		// create the slider thingy
		var div = document.createElement('div');
		div.className = "ZmFreeBusyView_slider";
		div.id = this._sliderId = ZmFreeBusyView.ID_PREFIX + "_slider";
		// TODO: add drag handlers
		div.innerHTML = "<div class='ZmFreeBusyView_slider_left'>&nbsp;</div><div class='ZmFreeBusyView_slider_right'>&nbsp;</div>";
		this.highlightAppointment(div);
		document.getElementById(this._scheduleContainerId).appendChild(div);
		this._focusFirstRow();
		//DBG.println(AjxStringUtil.htmlEncode(this.getHtmlElement().innerHTML));
	}
	var action = new AjxTimedAction();
	action.obj = this;
	action.method = datePickerCreation;
	AjxTimedAction.scheduleAction(action, 2);
};


// --------------------------------------------------------------------------------
// auto complete methods
// --------------------------------------------------------------------------------

ZmFreeBusyView.prototype._createAutoCompleteWidget = function () {
	var contactsClass = this._appCtxt.getApp(ZmZimbraMail.CONTACTS_APP);
	var contactsLoader = contactsClass.getContactList;
	var locCallback = new AjxCallback(this, this._getNewAutocompleteLocation, this);
	this._autocompleteList = new ZmAutocompleteListView(this, null, contactsClass, contactsLoader, locCallback);
	this._autocompleteList.setHandleEnterOnKeydown(true);
};

/**
 * Locates the autocomplete list below the given element -- which in these cases, should
 * always be an input element
 */
ZmFreeBusyView.prototype._getNewAutocompleteLocation = function(args) {
	var cv = args[0];
	var ev = args[1];
	var element = ev.element;
	var id = element.id;
	
	var viewEl = this.getHtmlElement();
	var location = Dwt.toWindow(element, 0, 0, viewEl);
	var size = Dwt.getSize(element);
	return new DwtPoint((location.x), (location.y + size.y) );
};

ZmFreeBusyView.prototype.highlightAppointment = function (optionalSliderDiv){
	var st = this.startDate.getTime();
	var et = this.endDate.getTime();
	var apptStartCell, dur;
	if (this._currentAppt.isInRange(st, et)) {
		apptStartCell = this._dateToCell(this._currentAppt.getStartDate());
		dur = this._currentAppt.getDuration();
	} else if (this._currentAppt.isStartInRange(st, et)){
		apptStartCell = this._dateToCell(this._currentAppt.getStartDate());
		dur = et - this._currentAppt.getStartTime();
	} else if (this._currentAppt.isEndInRange(st, et)) {
		apptStartCell = 0;
		dur = this._currentAppt.getEndTime() - st;
	} else if (this._currentAppt.beginsBeforeEndsAfter(st,et)){
		apptStartCell = 0;
		dur = 24*60*60*1000;
	} else {
		// hide the slider
		apptStartCell = 0;
		dur = -1;
	}

	this.highlightRange(apptStartCell, dur, optionalSliderDiv);
};

ZmFreeBusyView.prototype.setData = function (schedules, appt) {
	this.enable();
	if (this._autocompleteList) {
		this._autocompleteList.reset();
		this._autocompleteList.show(false);
	}

	this.setSchedules(schedules);
	this.setAppointment(appt);
	this._focusFirstRow();
};

ZmFreeBusyView.prototype.setAppointment = function (appt) {
	this._appt = appt;
	this._currentAppt.setDates(appt.getStartDate(), appt.getEndDate());
	this.highlightAppointment();
	this._updateDateTimes();
};

ZmFreeBusyView.prototype._renderSchedules = function ( buf, containerHeight) {
	var hours = this._getViewHours();
	var start = this._getStartHour();
	var numCells = (hours * 2);

	this._scheduleTableId = Dwt.getNextId();
	buf.append("<table id='", this._scheduleTableId, "' class='ZmFreeBusyView_scheduleCol_table' onmousedown='AjxCore.objectWithId(", this.__internalId,")._handleScheduleMouseDown(event)'><colgroup><col class='adCol2'><col class='adCol3'><col class='endZone'>");
	var className = (AjxEnv.isIE)? "ZmFreeBusyView_scheduleCol_colIE": "ZmFreeBusyView_scheduleCol_col";
	for (i = 0; i < numCells; ++i) {

		buf.append("<col class='",className,"'>");
	}
	buf.append("<col class='endZone'></colgroup>");
	buf.append("</colgroup>");

	var prevDayMessage = "<br>P<br>r<br>e<br>v<br>&nbsp;<br>d<br>a<br>y<br>";
	var nextDayMessage = "<br>N<br>e<br>x<br>t<br>&nbsp;<br>d<br>a<br>y<br>";

	// write the header Row
	buf.append("<tr class='firstRow'><td><div>&nbsp;</div></td><td><div>&nbsp;</div></td><td><div>&nbsp;</div></td>");
	var numHeaderCells = hours;
	for (i = 0; i < numHeaderCells; ++i) {
		buf.append("<td colspan=2><div class='hour'>", ZmFreeBusyView.hourMap[ (start + i) % hours], "</div></td>");
	}
	buf.append("<td><div>&nbsp;</div></td></tr>");

	// write the row with the paginate areas
	buf.append("<tr class='hiddenRow'><td></td><td></td><td class='endZoneCell' onclick='AjxCore.objectWithId(",this.__internalId,").paginate(", ZmFreeBusyView.PAGINATE_BACK, ")' rowspan='", (this._totalRows + 300), "'><div class='endZoneContainer'>", AjxImg.getImageHtml(ZmImg.CAL_FB_PREV_DAY), "</div></td>");
	for (i = 0; i < numCells; ++i) {
		buf.append("<td></td>");
	}
	buf.append("<td class='endZoneCell' rowspan=", (this._totalRows + 300), " onclick='AjxCore.objectWithId(",this.__internalId,").paginate(", ZmFreeBusyView.PAGINATE_FORWARD, ")'><div class='endZoneContainer'>", AjxImg.getImageHtml(ZmImg.CAL_FB_NEXT_DAY,"height:249px; border-bottom:1px solid #9F9F9F"),"</div></td></tr>");
	// write the aggregate row
	buf.append("<tr><td class='", ZmFreeBusyView.ADDRESS_CELL, "'><div class='mozWidth'>&nbsp;</div></td><td class='", ZmFreeBusyView.ADDRESS_INPUT_CELL,"'><div>All Attendees</div></td>");

	var rowBuf = new Array();
	var idx = 0;
	for (i = 0; i < numCells; ++i) {
		rowBuf[idx++] = "<td class='free'></td>";
	}
	rowBuf[idx++] = "</tr>";
	buf.append(rowBuf.join(""));

	idx = 0;
	rowBuf.length = 0;
	rowBuf[idx++] = "<tr><td></td><td class='empty'></td>";
	for (i = 0; i < numCells; ++i) {
		rowBuf[idx++] = "<td class='free'></td>";
	}
	rowBuf[idx++] = "</tr>";
	var emptyRowString = rowBuf.join("");

	this._dummyEmptyRow = Dwt.parseHtmlFragment(emptyRowString,"TR");
	buf.append(emptyRowString);
	for (var i = 0 ; i < this._totalRows; ++i){
		buf.append(emptyRowString);
	}
			   
};

ZmFreeBusyView.prototype._updateAggregatedSchedule = function (blocks) {
	for (var i = 0; i < blocks.length; ++i){
		this._aggregatedSchedule.push(blocks[i]);
	}
};

ZmFreeBusyView.prototype._createAggregatedSchedule = function () {
	this._aggregatedSchedule = new Array();
	var len = this.userSchedules.length;
	for ( var i = 0; i < len; ++i) {
		var blocks = this.userSchedules[i].blocks;
		var innerLen = blocks.length;
		for (var j = 0 ; j < innerLen; ++j){
			this._aggregatedSchedule.push(blocks[j]);
		}
	}
};

ZmFreeBusyView.prototype._getViewHours = function () {
	if (this._viewHours == null) {
		var duration = this.endDate.getTime() - this.startDate.getTime();
		this._viewHours = this._durationToCellNum(duration)/2;
	}
	return this._viewHours;
};

ZmFreeBusyView.prototype._getStartHour = function () {
	return this.startDate.getHours();
};


ZmFreeBusyView.prototype._dateToCell = function (date) {
	var start = this._getStartHour();
	var hours = date.getHours();
	var min = AjxDateUtil.getRoundedMins(date, 30);
	if (min == 60){
		hours++;
	} else if (min == 30){
		hours += 0.5;
	}
	if (start > hours ){
		hours += (24 - start);
	} else {
		hours = hours - start;
	}
	var cell = hours *2 + start;
	return cell;
};

// ========================================================================
// date picker rendering methods
// ========================================================================

ZmFreeBusyView.prototype._createDatePicker = function (date, isEnd) {
	var dateCell, timeHrCell, timeMinCell, timeAmPmCell;
	if (isEnd) {
		dateCell = document.getElementById(this._endDateId);
		timeHrCell = document.getElementById(this._endTimeHrId);
		timeMinCell = document.getElementById(this._endTimeMinId);
		timeAmPmCell = document.getElementById(this._endTimeAmPmId);
	} else {
		dateCell = document.getElementById(this._startDateId);
		timeHrCell = document.getElementById(this._startTimeHrId);
		timeMinCell = document.getElementById(this._startTimeMinId);
		timeAmPmCell = document.getElementById(this._startTimeAmPmId);
	}

	var dPick = new DwtButton(this);
	var dPickEl = dPick.getHtmlElement();
	dPick.setActionTiming(DwtButton.ACTION_MOUSEDOWN);
	var menu = new DwtMenu(dPick, DwtMenu.CALENDAR_PICKER_STYLE,
						   null, null, this);
	var cal = new DwtCalendar(menu);
	cal.__isEnd = (isEnd != null)? isEnd: false;
	cal.setDate(date);
	dPick.__cal = cal;
	cal.__date = date;
	var ls = new AjxListener(this, this._dateChangeHandler);
	cal.addSelectionListener(ls);
	dPick.setMenu(menu, true);
	menu.setAssociatedObj(dPick);
	dPickEl.parentNode.removeChild(dPickEl);
	dateCell.appendChild(dPickEl);
	dPick.setText(this._getDateValueStr(date));

	//var sel = new DwtSelect(this, this._getSelectOptions(_TIME_OF_DAY_CHOICES));
	var sel = new DwtSelect(this, ["1","2","3","4","5","6","7","8","9","10","11","12"]);
	var hours = date.getHours() % 12;
	hours = (hours == 0)? 12: hours;
	sel.setSelectedValue("" + hours);
	var selEl = sel.getHtmlElement();
	sel.__cal = cal;
	var ls = new AjxListener(this, this._hourChangeHandler);
	sel.addChangeListener(ls);
	selEl.parentNode.removeChild(selEl);
	timeHrCell.appendChild(selEl);

	var sel = new DwtSelect(this, ["00","15","30","45"]);
	sel.setSelectedValue(AjxDateUtil.getRoundedMins(date, 15));
	var selEl = sel.getHtmlElement();
	sel.__cal = cal;
	var ls = new AjxListener(this, this._minuteChangeHandler);
	sel.addChangeListener(ls);
	selEl.parentNode.removeChild(selEl);
	timeMinCell.appendChild(selEl);

	var sel = new DwtSelect(this, ["AM", "PM"]);
	sel.setSelectedValue( (date.getHours() >= 12)? "PM": "AM");
	var selEl = sel.getHtmlElement();
	sel.__cal = cal;
	var ls = new AjxListener(this, this._amPmChangeHandler);
	sel.addChangeListener(ls);
	selEl.parentNode.removeChild(selEl);
	timeAmPmCell.appendChild(selEl);
	sel.getHtmlElement().style.width = "50px";

};

ZmFreeBusyView.prototype._getSelectOptions = function (choices) {
	var selectOptions = new Array();
	for (var i = 0; i < choices.length; i++) {
		var choice = choices[i];
		var choiceValue = (typeof choice == "string" ? choice : choice.value);
		var choiceLabel = (typeof choice == "string" ? choice : choice.label);
		selectOptions[i] = new DwtSelectOptionData(choiceValue, choiceLabel);
	}
	return selectOptions;
};

ZmFreeBusyView.prototype._getDateValueStr = function(date) {
	if (date == null || !(date instanceof Date)) return "";
	return (date.getMonth()+1) + "/" + date.getDate() + "/" + (date.getFullYear());
};

ZmFreeBusyView.prototype._getTimeValueStr = function(date, rounded) {
	if (date == null || !(date instanceof Date)) date = new Date();
	var mins = date.getMinutes();
	var hours = date.getHours();
	if (rounded && mins != 30 && mins != 0) {
		mins = Math.round(mins/30) * 30;
		if (mins == 60){
			mins = 0;
			hours++;
		}
	}
	return hours + ":" + ((mins < 10) ? "0" + mins : mins);
};


// ========================================================================
// render helper methods
// ========================================================================
ZmFreeBusyView.prototype._getClassName = function (block) {
	return ZmFreeBusyView.BLOCK_TYPE_TO_CLASSNAME[block.type];
};

ZmFreeBusyView.prototype._renderExtraRows = function (buf, rowString, containerHeight, alreadyRendered) {
	if (this._totalRows > alreadyRendered) {
		var extraRows = this._totalRows - alreadyRendered;
		var replacedRowString = null;
		for (i = extraRows; i > 0; --i){
			buf.append(rowString);
		}
	}

};

ZmFreeBusyView.prototype._getAddressOnclickHandler = function () {
	return  (new Function ("event", "AjxCore.objectWithId(" + this.__internalId + ").handleAddrRowClick(event);"));
};

ZmFreeBusyView.prototype._getAddressOnchangeHandler = function () {
	return (new Function ("event", "AjxCore.objectWithId(" + this.__internalId + ").handleAddrChange(event);"));
};

ZmFreeBusyView.prototype._getAddressInput = function (address) {
	if (this._dummyInput == null) {
		this._dummyInput = document.createElement("input");
	}
	var i = this._dummyInput.cloneNode(true);
	i.onchange = this._getAddressOnchangeHandler();
	i.value = address;
	
	return i;
};

// ========================================================================
// row blasting methods
// ========================================================================

/** This assumes that the skeleton grid has been set in the dom **/
ZmFreeBusyView.prototype._writeAggregatedRow = function () {
	this._updateScheduleRow(this._aggregatedSchedule, 2, null, true);
};

ZmFreeBusyView.prototype._resetAggregatedRow = function () {
	this._resetScheduleRow(2);
	var scheduleTable = document.getElementById(this._scheduleTableId);
	var row = scheduleTable.rows[2];
	row.cells[0].className = ZmFreeBusyView.ADDRESS_CELL;
	row.cells[0].innerHTML = "<div class='mozWidth'></div>";
	row.cells[1].className = ZmFreeBusyView.ADDRESS_INPUT_CELL;
	row.cells[1].innerHTML = "<div>All Attendees</div>";
};

ZmFreeBusyView.prototype._resetScheduleRow = function (index, optionalRow) {
	var scheduleTable = document.getElementById(this._scheduleTableId);
	var row;
	if (optionalRow != null) {
		row = optionalRow;
	} else {
		row = scheduleTable.rows[index];
	}
	//var newRow = scheduleTable.rows[scheduleTable.rows.length - 1].cloneNode(true);
	var newRow = this._dummyEmptyRow.cloneNode(true);
	var startHour = this._getStartHour();
	scheduleTable.lastChild.replaceChild(newRow, row);
};

ZmFreeBusyView.prototype._updateRow = function (schedule, index, optionalRow) {
	var row;
	if (optionalRow != null) {
		row = optionalRow;
	} else {
		var scheduleTable = document.getElementById(this._scheduleTableId);
		row = scheduleTable.rows[index];
		if (row == null) {
			row = this._addRow(scheduleTable);
		}
	}
	this._updateAddressRow(schedule, index, row);
	this._updateScheduleRow(schedule, index, row);	
};

ZmFreeBusyView.prototype._addRow = function (scheduleTable) {
	var row = scheduleTable.rows[scheduleTable.rows.length - 1].cloneNode(true);
	scheduleTable.tBodies[0].insertBefore(row, null);
	this._totalRows++;
	return row;
};

ZmFreeBusyView.prototype._removeRow = function (index) {
	var scheduleTable = document.getElementById(this._scheduleTableId);
	//var row = scheduleTable.rows[index]
	if (index < scheduleTable.rows.length) {
		scheduleTable.deleteRow(index);
		this._totalRows--;
	}
};

ZmFreeBusyView.prototype._updateEmptyRow = function (index) {
	this._updateAddressRow(null, index, null, true);
};

ZmFreeBusyView.prototype._updateAddressRow = function (userSchedule, index, optionalRow, empty){
	var row;
	if (optionalRow != null) {
		row = optionalRow;
	} else {
		var scheduleTable = document.getElementById(this._scheduleTableId);
		row = scheduleTable.rows[index];
		if (row == null) {
			row = this._addRow(scheduleTable);
		}
	}

	var addr = null;
	if (empty != true){
		if (userSchedule != null) {
			row.id = "LMFBA_" + userSchedule.getUniqueId();
			addr = userSchedule.id;
		}
	} else {
		row.id = "LMFBA_Empty";
		addr = ZmFreeBusyView.ADD_NAME_MSG;
	}
	var onclickFunc = this._getAddressOnclickHandler();
	var cell0 = row.cells[0];
	var cell1 = row.cells[1];
	cell0.onclick = onclickFunc;
	cell1.onclick = onclickFunc;
	cell0.className = ZmFreeBusyView.ADDRESS_CELL;
	if (empty == true) {
		cell1.className = ZmFreeBusyView.ADDRESS_INPUT_EMPTY_CELL;
	} else {
		cell1.className = ZmFreeBusyView.ADDRESS_INPUT_CELL;
	}
	cell1.innerHTML = "";
	cell1.appendChild(this._getAddressInput(addr));
	cell1.firstChild.onclick = onclickFunc;
	if (this._appCtxt.get(ZmSetting.CONTACTS_ENABLED)) {
		this._autocompleteList.handle(cell1.firstChild);
		//this._setEventHandler(this._fieldId[type], "onFocus");
		//this._setEventHandler(this._fieldId[type], "onClick");
	}

};

ZmFreeBusyView.prototype._updateScheduleRow = function (userSchedule, index, optionalRow, aggregated) {
	var row;
	if (optionalRow != null) {
		row = optionalRow;
	} else {
		var scheduleTable = document.getElementById(this._scheduleTableId);
		row = scheduleTable.rows[index];
	}
	var hours = this._getViewHours();
	var start = this._getStartHour();
	var numCells = start + (hours * 2);
	var colspan = -1;
	var j = 0;
	var i = start;
	var blocks = null;
	if (!aggregated) {
		blocks = userSchedule.blocks;
	} else {
		blocks = userSchedule;
	}
	var sLen = blocks.length;
	for (i = 0 ; i < blocks.length; ++i) {
		colspan = 1;
		var className = "";
		var bStart = blocks[i].getStartHour();
		if (start > bStart ){
			bStart += (24 - start);
		} else {
			bStart = bStart - start;
		}
		var dur = blocks[i].getDuration();
		colspan = this._durationToCellNum(dur);
		className = this._getClassName(blocks[i]);
		var cellNum = (bStart * 2);
		var cell = row.cells[cellNum + 2];
		var baseClassName = className;
		for (var y = colspan; (y > 0 && (cell != null)); y--) {
			if (aggregated) {
				if (cell.className){
					var clArr = cell.className.split("Higlighted");
					var baseCl = clArr[0];
					if (ZmFreeBusyView.TYPE_RANKING[baseCl] > ZmFreeBusyView.TYPE_RANKING[className]){
						continue;
					}
				}
			}

			className = baseClassName;
			var highlight = (cell.className.indexOf("Highlighted") != -1);
			if (highlight) {
				className = ZmFreeBusyView.CLASS_TO_HIGHLIGHTEDCLASS[baseClassName];
			}
			cell.className = className;
			cell = cell.nextSibling;
		}
	}
};


// ========================================================================
// Event handling methods
// ========================================================================
ZmFreeBusyView.prototype.paginate = function (direction) {

	var len = this.userSchedules.length;
	var uids = new Array();
	for (var i = 0; i < len; ++i ){
		uids.push(this.userSchedules[i].id);
	}
	var v;
	switch (direction) {
	case ZmFreeBusyView.PAGINATE_FORWARD:
		AjxDateUtil.roll(this.startDate, AjxDateUtil.DAY, 1);
		AjxDateUtil.roll(this.endDate, AjxDateUtil.DAY, 1);
		break;
	case ZmFreeBusyView.PAGINATE_BACK:
		AjxDateUtil.roll(this.startDate, AjxDateUtil.DAY, -1);
		AjxDateUtil.roll(this.endDate, AjxDateUtil.DAY, -1);
		break;
	};
	this.getSchedulesForDates(this.startDate, this.endDate, uids);
};

ZmFreeBusyView.prototype.getSchedulesForDates = function (start, end, uids) {
	this.startDate.setTime(start.getTime());
	this.endDate.setTime(end.getTime());
	this.userSchedules = ZmUserSchedule.getSchedules(this.startDate, this.endDate, uids);
	this.setSchedules(this.userSchedules);
	
	// set the display date
	document.getElementById(this._rangeDateId).innerHTML = AjxDateUtil.getTimeStr(this.startDate, "%M %d, %Y");
	this.highlightAppointment();

};

ZmFreeBusyView.prototype.setSchedules = function (schedules){
	var len = (schedules != null)? schedules.length: 0;
	var oldLen = this.userSchedules.length;
	for (var i = 0; i < len ; ++i) {
		this._updateRow(schedules[i], i+3);
	}
	// reset any rows that appeared previously, and add the empty 
	// row at the end.
	if (len < oldLen){
		var j = i;
		for (i = oldLen; i > j ; --i) {
			if (i >= this._origTotalRows){
				this._removeRow(i + 3);
			} else {
				this._resetScheduleRow(i + 3 );
			}
		}
	}
	this._updateEmptyRow(len + 3);
	
	this.userSchedules = (schedules != null)? schedules: new Array();
	this._createAggregatedSchedule();
	this._resetAggregatedRow();
	this._writeAggregatedRow();
};

ZmFreeBusyView.prototype._dateChangeHandler = function (event) {
	var newDate = event.detail;
	var cal = event.item;
	var dateChanged = cal.__date;
	var dur = this._currentAppt.getDuration();

 	dateChanged.setDate(newDate.getDate());
 	dateChanged.setYear(newDate.getFullYear());
 	dateChanged.setMonth(newDate.getMonth());

	this._updateTime(dur, cal.__isEnd);
};

ZmFreeBusyView.prototype._minuteChangeHandler = function (event) {
	var sel = event._args.selectObj;
	var cal = sel.__cal;
	var date = cal.__date;
	var dur = this._currentAppt.getDuration();
	var minutesStr = event._args.newValue;
	var minutes = parseInt(minutesStr);
	if (!isNaN(minutes)) {
		date.setMinutes(minutes);
	}
	this._updateTime(dur, cal.__isEnd);
};

ZmFreeBusyView.prototype._amPmChangeHandler = function (event) {
	var sel = event._args.selectObj;
	var cal = sel.__cal;
	var date = cal.__date;
	var ampmStr = event._args.newValue;
	var dur = this._currentAppt.getDuration();
	var isPM = (ampmStr == AjxMsg.pm);
	var hours = date.getHours() % 12;
	
	date.setHours(hours + (isPM ? 12 : 0));

	this._updateTime(dur, cal.__isEnd);

};

ZmFreeBusyView.prototype._updateTime = function (dur, isEnd, isHour) {
	var oldStartDate = this._currentAppt.getStartDate().getDate();
	// make adjustments ( apply our constraints );
	this._adjustStartEndDate(dur, isEnd, isHour);

	var newStartDate = this._currentAppt.getStartDate().getDate();
	// update the view
	this._updateDateTimes();

	// either change the date range, or just highlight the appointment time.
	if (!isEnd || oldStartDate != newStartDate ) {
		var len = this.userSchedules.length;
		var uids = new Array();
		for (var i = 0; i < len; ++i ){
			uids.push(this.userSchedules[i].id);
		}
		var s = this._currentAppt.getStartTime();
		this.startDate.setTime(s);
		this.startDate.setHours(0,0,0,0);
		this.endDate.setTime(s + 24*60*60*1000);
		this.endDate.setHours(0,0,0,0);
		this.getSchedulesForDates(this.startDate, this.endDate, uids);
	} else {
		this.highlightAppointment();
	}
	
};

ZmFreeBusyView.prototype._hourChangeHandler = function (event) {
	var sel = event._args.selectObj;
	var cal = sel.__cal;
	var date = cal.__date;
	var dur = this._currentAppt.getDuration();
	var hoursStr = event._args.newValue;
	var hours = parseInt(hoursStr);
	if (!isNaN(hours)) {
		if (hours == 12) hours = 0;
		var wasPM = (date.getHours() > 11);
		if (wasPM) hours += 12;
		date.setHours(hours);
	}
	
	this._updateTime(dur, cal.__isEnd, true);
};


ZmFreeBusyView.prototype._getRowFromAddressEvent = function ( event ){
	var target = DwtUiEvent.getTarget(event);
	return this._getAncestor(target, "TR");
};

ZmFreeBusyView.prototype.handleAddrRowClick = function ( event ) {
	event = DwtUiEvent.getEvent(event);
	var target = DwtUiEvent.getTarget(event);
	var row = this._getRowFromAddressEvent(event);
	var itemId = row.id.split("_")[1];
	var item = null;
	if (itemId == "Empty") {
		item = this._dummyBlock;
	} else {
		for (var i = 0; i < this.userSchedules.length; ++i) {
			if (this.userSchedules[i].getUniqueId() == itemId){
				item = this.userSchedules[i];
				break;
			}
		}
	}
	if (event.altKey) {
		// do nothing
	} else if (event.ctrlKey) {
		// not working correctly
		this._selectionManager.toggleItem(item);
	} else if (event.shiftKey) {
		this._selectionManager.selectFromAnchorToItem(item);
	} else {
		this._selectionManager.selectOneItem(item);
	}
};

ZmFreeBusyView.prototype._getAncestor = function (element, tag) {
	if (!element){
		return null;
	}
	var retEl = null;
	while (element) {
		if (element.tagName == tag) {
			retEl = element;
			break;
		}
		element = element.parentNode;
	}
	return retEl;
};

ZmFreeBusyView.prototype._getScheduleForEmptyRow = function (row) {
	var rowIndex = row.rowIndex;
	this._updateEmptyRow(rowIndex + 1);
	var sched = new ZmUserSchedule();
	this.userSchedules[this.userSchedules.length] = sched;
	row.id = "LMFBA_" + sched.getUniqueId();
	index = rowIndex;
	this._selectionManager.selectOneItem(this._dummyBlock);
	return sched;
};

ZmFreeBusyView.ADDR_REGEX = /.*<([^>]*)>.*/;
ZmFreeBusyView.prototype._getEmailAddressFromTargetText = function ( value ) {
	// Check for < >, and take the text in between, if they exist
	var retVal = value;
	if (value.indexOf('<') != -1){ 
		var results = ZmFreeBusyView.ADDR_REGEX.exec(value);
		if (results && results[1]) {
			retVal = results[1];
		}
	}
	return retVal;
};


ZmFreeBusyView.prototype.handleAddrChange = function ( event ) {
	// This is really to prevent us making a server request when
	// the view is going away.
	if (!this._enabled) return true;

	var target = DwtUiEvent.getTarget(event);
	if (target.tagName == "INPUT"){
		var tr = this._getAncestor(target, "TR");
		if (target.value != null && target.value != "") {
			var sched = null;
			var index = -1;
			// create the new row
			// see if we are dealing with the empty row
			if (tr.id != null) {
				index = tr.rowIndex;
				if (tr.id.indexOf("Empty")!= -1){
					sched = this._getScheduleForEmptyRow(tr);
				} else {
					if (index != -1) {
						sched = this.userSchedules[index - 2];
					}
				}

				var value = this._getEmailAddressFromTargetText(target.value);

				// send a request to the server for the free busy information for the new
				// address.
				// TODO: This should probably live in a controller somewhere.
				sched.getSchedule(this.startDate, this.endDate, value, true);
				
				// update the view
				this._updateRow(sched, index);
				this._updateAggregatedSchedule(sched.blocks);
				this._writeAggregatedRow();
			}
		} else {
			// when there is no value in the input, if it's the empty row,
			// then just replace the message in the input.
			// if it's one of the intialized rows, then this should trigger 
			// a row deletion.
			if (tr.id != null) {				
				if (tr.id.indexOf("Empty")!= -1) {
					var selectedItems = this._selectionManager.getItems();
					if (selectedItems.get(0) != this._dummyBlock){
						target.value = ZmFreeBusyView.ADD_NAME_MSG;
					}
				} else {

					// delete row
					var newRow = tr.parentNode.lastChild.cloneNode(true);
					tr.parentNode.appendChild(newRow);
					var index = tr.rowIndex;
					this.userSchedules.splice((index - 3), 1);
					tr.parentNode.removeChild(tr);

					// reset the aggregated row
					this._resetAggregatedRow();
					// reset the aggregated model
					this._createAggregatedSchedule();
					// rewrite the aggregated row
					this._writeAggregatedRow();
				}
			}
		}
	}	
	return true;
};

ZmFreeBusyView.prototype._getScheduleIndexById = function (schedId) {
	var index = -1;
	for (var i = 0 ; i < this.userSchedules.length ; ++i ){
		if (this.userSchedules[i].getUniqueId() == schedId ){
			sched = this.userSchedules[i];
			index = i;
			break;
		}
	}
	return index;
};

ZmFreeBusyView.prototype._handleScheduleMouseDown = function (event){
	var target = DwtUiEvent.getTarget(event);
	var hourCell = target.cellIndex;
	// if we are in the address section of the table, don't do anything
	//DBG.println("handleScheduleMouseDown: target.tagName = " + target.tagName + " index = " + target.cellIndex);
	if (hourCell < 2 || target.tagName != "TD" || target.parentNode.rowIndex < 2) return;
	hourCell = hourCell - 2;
	var hour = (hourCell/2) + this._getStartHour();
	var mins = ((hour * 60) % 60);
	var startApptDate = this._currentAppt.getStartDate();
	var endApptDate = this._currentAppt.getEndDate();
	var sd = this.startDate;
	startApptDate.setFullYear(sd.getFullYear(), sd.getMonth(), sd.getDate())
	startApptDate.setHours(hour,mins,0,0);
	endApptDate.setFullYear( sd.getFullYear(), sd.getMonth(), sd.getDate());
	endApptDate.setHours( ( (mins == 0)? hour: ++hour), ( (mins == 0)? 30: 0), 0, 0 );

	this._updateDateTimes();
	this.highlightRange(hourCell, 1800000);
};

ZmFreeBusyView.prototype._selectAddress = function ( cell, selected ) {
	if (cell) {
		if (selected) {
			cell.className = ZmFreeBusyView.ADDR_SELECTED;
		} else {
			cell.className = ZmFreeBusyView.ADDRESS_CELL;
		}
	}
};

ZmFreeBusyView.prototype._updateDateTimes = function () {
	//DBG.println("_updateDateTimes startDate = ", this._currentAppt.getStartDate(), " end = " , this._currentAppt.getEndDate());
	var startDateCell = document.getElementById(this._startDateId);
	var startTimeHrCell = document.getElementById(this._startTimeHrId);
	var startTimeMinCell = document.getElementById(this._startTimeMinId);
	var startTimeAmPmCell = document.getElementById(this._startTimeAmPmId);
	var endDateCell = document.getElementById(this._endDateId);
	var endTimeHrCell = document.getElementById(this._endTimeHrId);
	var endTimeMinCell = document.getElementById(this._endTimeMinId);
	var endTimeAmPmCell = document.getElementById(this._endTimeAmPmId);
	
	var startDate = this._currentAppt.getStartDate();
	var b = AjxCore.objectWithId(startDateCell.firstChild.dwtObj);
	if (b) {
		b.setText(this._getDateValueStr(startDate));
		b.__cal.setDate(startDate, true);
	}
	var sel = AjxCore.objectWithId(startTimeHrCell.firstChild.dwtObj);
	if (sel) {
		var hr = startDate.getHours() %12;
		hr = (hr == 0) ? "12": "" + hr;
		sel.setSelectedValue(hr);
	}

	sel = AjxCore.objectWithId(startTimeMinCell.firstChild.dwtObj);
	if (sel) {
		var min = AjxDateUtil._pad(AjxDateUtil.getRoundedMins(startDate));
		sel.setSelectedValue(min);
	}
	
	sel = AjxCore.objectWithId(startTimeAmPmCell.firstChild.dwtObj);
	if (sel) {
		var amPm = (startDate.getHours() >= 12)? AjxMsg.pm: AjxMsg.am;
		sel.setSelectedValue(amPm);
	}


	var endDate = this._currentAppt.getEndDate();
	b = AjxCore.objectWithId(endDateCell.firstChild.dwtObj);
	if (b) {
		b.setText(this._getDateValueStr(endDate));
		b.__cal.setDate(endDate,true);
	}

	sel = AjxCore.objectWithId(endTimeHrCell.firstChild.dwtObj);
	if (sel) {
		var hr = endDate.getHours() %12;
		hr = (hr == 0) ? "12": "" + hr;
		sel.setSelectedValue(hr);
	}

	sel = AjxCore.objectWithId(endTimeMinCell.firstChild.dwtObj);
	if (sel) {
		var min = AjxDateUtil._pad(AjxDateUtil.getRoundedMins(endDate));
		sel.setSelectedValue(min);
	}
	
	sel = AjxCore.objectWithId(endTimeAmPmCell.firstChild.dwtObj);
	if (sel) {
		var amPm = (endDate.getHours() >= 12)? AjxMsg.pm: AjxMsg.am;
		sel.setSelectedValue(amPm);
	}
};

ZmFreeBusyView.prototype.getAppointmentAttendees = function () {
	var tempArr = new Array();
	var userName = this.shell.getData(ZmAppCtxt.LABEL).get(ZmSetting.USERNAME);
	for (var i = 0; i < this.userSchedules.length; ++i) {
		if (this.userSchedules[i].id == userName) {
			continue;
		}
		tempArr.push(this.userSchedules[i].id);
	}
	var possiblyEmptyRow = document.getElementById("LMFBA_Empty");
	var val = (possiblyEmptyRow != null)? possiblyEmptyRow.cells[1].firstChild.value: null;
	if (val != "" && val != ZmFreeBusyView.ADD_NAME_MSG) {
		tempArr.push(val);
	}
	return tempArr.toString();
};

ZmFreeBusyView.prototype.getAppointmentStartDate = function () {
	return this._currentAppt.getStartDate();
};

ZmFreeBusyView.prototype.getAppointmentEndDate = function () {
	return this._currentAppt.getEndDate();
};

ZmFreeBusyView.prototype.disable = function () {
	this._enabled = false;
};

ZmFreeBusyView.prototype.enable = function () {
	this._enabled = true;
};

ZmFreeBusyView.prototype._focusFirstRow = function () {
	this._selectionManager.selectOneItem(this.userSchedules[0]);
};

ZmFreeBusyView.prototype.saveAppointmentInfo = function () {
	this._appt.setStartDate(this._currentAppt.getStartDate());
	this._appt.setEndDate(this._currentAppt.getEndDate());
	this._appt.attendees = this.getAppointmentAttendees();
};

ZmFreeBusyView.prototype._adjustStartEndDate = function (duration, endChanged, hourChanged) {
	var startDate = this._currentAppt.getStartDate();
	var endDate = this._currentAppt.getEndDate();

	if (hourChanged) {
		var startHrs = startDate.getHours();
		var endHrs = endDate.getHours();
		if (endHrs < startHrs && startHrs < 12){
			endDate.setHours(endHrs + 12);
		}
	}
	
	var startTime = startDate.getTime();
	var endTime = endDate.getTime();	

	// check time
	if (!endChanged || (endTime <= startTime)){
		var e, s;
		if (endChanged) {
			e = startDate;
			s = endDate;
			duration = (-1* duration);
		} else {
			e = endDate;
			s = startDate;
			duration = duration;
		}
		e.setTime(s.getTime() + duration);
	}
};

// ========================================================================
// slider handling methods
// ========================================================================

ZmFreeBusyView.prototype._getCellWidth = function () {
	if (this._cellWidth == null || this._cellWidth == 0) {
		var paddingFactor = 1;
		var start = this._getStartHour();
		var aCell = document.getElementById(this._scheduleTableId).rows[2].cells[3];
		this._cellWidth = parseInt(DwtCssStyle.getProperty(aCell, "width"));
		//DBG.println("cell width = " + this._cellWidth);
		this._cellWidth = (!isNaN(this._cellWidth))? this._cellWidth: 0;
		if (!AjxEnv.isIE){
			var paddingRight = parseFloat(DwtCssStyle.getProperty(aCell, "padding-right"));
			var paddingLeft = parseFloat(DwtCssStyle.getProperty(aCell, "padding-left"));
			paddingRight = (!isNaN(paddingRight))? paddingRight: 0;
			paddingLeft = (!isNaN(paddingRight))? paddingLeft: 0;
			var borderRight = parseFloat(DwtCssStyle.getProperty(aCell, "border-right-width"));
			var borderLeft = parseFloat(DwtCssStyle.getProperty(aCell, "border-left-width"));
			borderRight = isNaN(borderRight)? 0: (borderRight * paddingFactor);
			borderLeft = isNaN(borderLeft)? 0: (borderLeft * paddingFactor);
			this._cellWidth += paddingRight + paddingLeft + borderRight + borderLeft;
		}
	}
	return this._cellWidth;
};

ZmFreeBusyView.prototype._durationToCellNumRelativeToStart = function (duration, optionalStartCell) {
	var startCell = (optionalStartCell != null)? optionalStartCell: this._dateToCell(this._currentAppt.getStartDate());
	var start = this._getStartHour();
	var normalizedStartCell = startCell - start;
	var dur = this._durationToCellNum(duration);
	return Math.min(dur,  (48  - normalizedStartCell));
};

ZmFreeBusyView.prototype._durationToCellNum = function (duration, optionalStartCell) {
	return Math.round((duration/1000) / (60 * 30));
};

ZmFreeBusyView.prototype.highlightRange = function(startCell, duration, optionalSlider){
	var slider = optionalSlider? optionalSlider : document.getElementById(this._sliderId);
	if (duration > 0) {
		this._setSliderBounds(startCell, duration, this._getCellWidth(), slider);
	} else {
		this._hideSlider(slider);
	}
	
	var durationCellNum = 0;
	if (( this._lastHighlightedHour!= null) && (this._lastHighlightedDuration != null)) {
		durationCellNum = this._durationToCellNumRelativeToStart(this._lastHighlightedDuration, this._lastHighlightedHour);
		this._toggleHighlight(false, this._totalRows, durationCellNum, this._lastHighlightedHour);
	}
	if (duration > 0 ) {
		durationCellNum = this._durationToCellNum(duration);
		this._toggleHighlight(true, this._totalRows, durationCellNum, startCell);
		
		this._lastHighlightedHour = startCell;
		this._lastHighlightedDuration = duration;
	} else {
		this._lastHighlightedHour = null;
		this._lastHighlightedDuration = null;
	}
};
ZmFreeBusyView.CLASS_HIGHLIGHTED = "Highlighted";

ZmFreeBusyView.prototype._toggleHighlight = function (highlight, rows, numCells, startCellIndex) {
	
	var cell = null;
	var table = document.getElementById(this._scheduleTableId);
	var start = this._getStartHour();
	if (!AjxEnv.isIE) {
		var rows = table.rows;
		var numRows = rows.length;		
		for(var i = 2; i < numRows; i++) {
			var row = rows[i];
			var rowLen = row.cells.length;
			var x = (startCellIndex - start + 2);
			var stopCell = x + numCells;
			var cell = row.cells[x];
			var newClass;
			for (; (x < stopCell && x < rowLen); ++x){
				cell = row.cells[x];
				if (!highlight) {
					newClass = ZmFreeBusyView.HIGHLIGHTEDCLASS_TO_CLASS[cell.className];
					if (newClass != null) {
						cell.className = newClass;
					}
				} else {
					cell.className = ZmFreeBusyView.CLASS_TO_HIGHLIGHTEDCLASS[cell.className];
				}
			}
		}
	} else {
		var x = (startCellIndex - start + 3);
		var stopCell = x + numCells;
		for (var i = x ; i < stopCell; ++i) {
			if (highlight) {
				table.firstChild.childNodes[i].style.backgroundColor = "#ADD6D6";
			} else {
				table.firstChild.childNodes[i].style.backgroundColor = "";
			}
		}
	}
};

ZmFreeBusyView.prototype._hideSlider  = function(slider) {
	slider.style.display = "none";
};

ZmFreeBusyView.prototype._setSliderBounds = function (startCell, duration, cellWidth, slider){
	var scheduleTable = document.getElementById(this._scheduleTableId);
	var scheduleContainer = document.getElementById(this._scheduleContainerId);
	// get the location relative to our container, since the container will move around.

	var location = Dwt.toWindow(scheduleTable.rows[2].cells[startCell + 2], 0, 0, scheduleContainer);
	var tableSize = Dwt.getSize(scheduleTable);

	var newLeft = location.x;
	slider.style.left = newLeft + "px";
	slider.style.top  = location.y + "px";
	var extraRows = 3;
	//slider.style.height = ((this._totalRows + extraRows)* ZmFreeBusyView.ROW_HEIGHT) + "px";
	var topTwoRowsHeight = 30;
	if (AjxEnv.isIE) {
		topTwoRowsHeight = 26
	}
	slider.style.height = (tableSize.y - topTwoRowsHeight) + "px";
	var hours = this._getViewHours();
	var numCells = (hours * 2) + 1;
	var widthInCells = this._durationToCellNumRelativeToStart(duration, startCell);
	//DBG.println("duration = ", duration , " startCell = ", startCell, " widthInCells = ", widthInCells, " numCells = ", numCells);
	var addition = 0;
	if ((startCell + widthInCells + 2) > numCells ) {
		widthInCells-- ;
		addition = cellWidth;
	}
	//DBG.println("2 duration = ", duration , " startCell = ", startCell, " widthInCells = ", widthInCells, " numCells = ", numCells);
	//DBG.println("getting cell ", startCell + widthInCells + 2 , " -- ", scheduleTable.rows[2].cells[startCell + widthInCells + 2]);
	var endLoc = Dwt.toWindow(scheduleTable.rows[2].cells[startCell + widthInCells + 2], 0, 0, scheduleContainer);
	endLoc.x = endLoc.x + addition;
	slider.style.width = ( endLoc.x - location.x) + "px";
	slider.style.display = "";
}


// ========================================================================
// AjxSelectionManager interface methods
// ========================================================================

ZmFreeBusyView.prototype.getItemCount = function () {
	return this.userSchedules.length + 1;
};

ZmFreeBusyView.prototype.getItem = function (index) {
	if (index == this.userSchedules.length){
		return this._dummyBlock;
	}
	return this.userSchedules[index];
};

ZmFreeBusyView.prototype.itemSelectionChanged = function (item, index, isSelected) {
	var id = null;
	var inputChangeNeeded = false;
	if (index == this.userSchedules.length) {
		id = "LMFBA_Empty";
		inputChangeNeeded = true;
	} else {
		id = "LMFBA_" + item.getUniqueId();
	}
	var row = document.getElementById(id);
	// if the user clicks on a row to start the delete, then
	// the row may have been removed already.
	if (row != null) {
		this._selectAddress(row.cells[0], isSelected);
		var input = row.cells[1].firstChild;
		if (inputChangeNeeded && isSelected && input.value == ZmFreeBusyView.ADD_NAME_MSG){
			row.cells[1].className = ZmFreeBusyView.ADDRESS_INPUT_CELL;
			input.value = "";
		} else if (inputChangeNeeded && !isSelected && input.value == ""){
			row.cells[1].className = ZmFreeBusyView.ADDRESS_INPUT_EMPTY_CELL;
			input.value =  ZmFreeBusyView.ADD_NAME_MSG;
		}
		if (isSelected){
			input.focus();
		}
	}
};

ZmFreeBusyView.prototype.selectionChanged = function () {
	//DBG.println("Selection Changed called");
	// do nothing for now
};


// ========================================================================
// ZmUserSchedule class
// ========================================================================
function ZmUserSchedule () {
	this.blocks = new Array();
	this._objectId = ZmUserSchedule._internalIds++;
}
ZmUserSchedule._internalIds = 0;
ZmUserSchedule.prototype.setId = function (id){
	this.id = id;
};

ZmUserSchedule.prototype.getUniqueId = function () {
	return this._objectId;
}

/**
 * This is specifically for sorting. Comparisons of
 * these blocks should really only compare the user names.
 */ 
ZmUserSchedule.prototype.valueOf = function () {
	return (this.id + this._objectId);
};

ZmUserSchedule.getSchedules = function (start, end, uids) {
	var soapDoc = AjxSoapDoc.create("GetFreeBusyRequest", "urn:zimbraMail");
	soapDoc.setMethodAttribute("s", start.getTime());
	soapDoc.setMethodAttribute("e", end.getTime());
	var u = null;
	if (uids.constructor === Array){
		if (uids.length > 0) {
			u = uids.join(',');
		} else {
			return new Array();
		}
	} else if (typeof(uids) == 'string'){
		u = uids;
	}
	soapDoc.setMethodAttribute("uid", u);
	var resp = null;
	if (ZmUserSchedule.commandSender != null) {
		resp = ZmUserSchedule.commandSender.sendRequest(soapDoc);
	} else {
		// testing only
		resp = ZmCsfeCommand.invoke(soapDoc, null, null, null, false);
		resp = resp.Body;
	}
	if (resp != null) {
		return ZmUserSchedule.loadFromDom(resp);
	} else {
		var users = uids.split(',');
		var numUsers = users.length;
		var userSchedules = new Array(numUsers);
		for (var i = 0; i < numUsers; ++i) {
			userSchedules[i] = new ZmUserSchedule();
			userSchedules[i].blocks[i] = new ZmBusyBlock(start.getTime(), end.getTime(), "f");
			userSchedules[i].id = users[i];
		}
		return userSchedules;
	}
}

ZmUserSchedule.loadFromDom = function (freeBusyResponse) {
	// parse the GetFreeBusyResponse message.
	//DBG.println("LoadFromDom: resp=>");
	//DBG.dumpObj(freeBusyResponse);		
	var users = freeBusyResponse.GetFreeBusyResponse.usr;
	var len = users.length;
	var userSchedules = new Array();
	for (var i = 0; i < len; i++) {
		var userS = new ZmUserSchedule();
		ZmUserSchedule._parseOneScheduleResponse(users[i], userS);
		userSchedules.push(userS);
	}
	return userSchedules;
};

ZmUserSchedule._parseOneScheduleResponse = function (users, userSchedObj) {
	for (key in users) {
		if (key == 'id'){
			userSchedObj.id = users[key];
			continue;
		}
		var typeArr = users[key];
		for (var j = 0; j < typeArr.length; j++){
			var start = typeArr[j].s;
			var end = typeArr[j].e;
			
			var block = new ZmBusyBlock(start, end, key);
			userSchedObj.blocks.push(block);
		}
	}
};

ZmUserSchedule.prototype.getSchedule = function (start, end, uid, force) {
	if (force || this.blocks.length <= 0){
		// if we've been forced to refresh, then zero out our blocks
		if (this.blocks.length > 0 ){
			this.blocks = new Array();
		}
		// go to the server
		var soapDoc = AjxSoapDoc.create("GetFreeBusyRequest", "urn:zimbraMail");
		soapDoc.setMethodAttribute("s", start.getTime());
		// TODO: Not sure what the period should be here
		soapDoc.setMethodAttribute("e", end.getTime());
		soapDoc.setMethodAttribute("uid", uid);
		// TODO
		if (ZmUserSchedule.commandSender != null) {
			var resp = ZmUserSchedule.commandSender.sendRequest(soapDoc);
		} else {
			// testing only
			var resp = ZmCsfeCommand.invoke(soapDoc, null, null, null, false).Body;
		}
		var user = resp.GetFreeBusyResponse.usr[0];
		ZmUserSchedule._parseOneScheduleResponse(user, this);
	}
	return this.blocks;
};

ZmUserSchedule.setCommandSender = function (sender) {
	ZmUserSchedule.commandSender = sender;
};

// ========================================================================
// ZmBusyBlock class
// ========================================================================

function ZmBusyBlock (start, end, type) {
	this.startTime = start;
	this.endTime = end;
	this.type = type;
	this.duration = end - start;
}

ZmBusyBlock.prototype.isInRange = function (startTime, endTime) {
	var tst = this.startTime;
	return (tst >= startTime && tst < endTime);
};

ZmBusyBlock.prototype.getDuration = function () {
	return this.duration;
};

ZmBusyBlock.prototype.getStartHour = function () {
	if (this._startDate == null) {
		this._startDate = new Date(this.startTime);
		this._startDate = AjxDateUtil.roundTimeMins(this._startDate, 30);
		this._startHour = this._startDate.getHours();
		if (this._startDate.getMinutes() == 30){
			this._startHour += 0.5;
		}
	}
	return this._startHour;
};

ZmBusyBlock.prototype.isOverlapping = function(otherBlock) {
	var tst = this.startTime;
	var tet = this.endTime;
	var ost = otherBlock.startTime;
	var oet = otherBlock.endTime;
	
	return (tst >= ost && tst < oet) || (tet > ost && tet < oet);
};

function ZmFreeBusyAppointment (startDate, endDate, fbView) {
	this._startDate = new Date(startDate.getTime());
	this._endDate = new Date(endDate.getTime());
}

ZmFreeBusyAppointment.prototype.setDates = function (startDate, endDate) {
	this._startDate.setTime(startDate.getTime());
	this._endDate.setTime(endDate.getTime());
};

ZmFreeBusyAppointment.prototype.isInRange = function(startTime, endTime) {
	var tst = this.getStartTime();
	var tet = this.getEndTime();	
	return (tst > startTime && tet < endTime);
};

/**
 * return true if the start time of this appt is within range
 */
ZmFreeBusyAppointment.prototype.isStartInRange = function(startTime, endTime) {
	var tst = this.getStartTime();
	return (tst < endTime && tst >= startTime);
};

/**
 * return true if the end time of this appt is within range
 */
ZmFreeBusyAppointment.prototype.isEndInRange = function(startTime, endTime) {
	var tet = this.getEndTime();
	return (tet <= endTime && tet > startTime);
};

ZmFreeBusyAppointment.prototype.beginsBeforeEndsAfter = function (startTime, endTime) {
	var tst = this.getStartTime();
	var tet = this.getEndTime();	
	return (tst < startTime && tet > endTime);
};

ZmFreeBusyAppointment.prototype.getStartDate = function() {
	return this._startDate;
};

ZmFreeBusyAppointment.prototype.getEndDate = function() {
	return this._endDate;
};

ZmFreeBusyAppointment.prototype.getStartTime = function() {
	return this._startDate.getTime();
};

ZmFreeBusyAppointment.prototype.getEndTime = function() {
	return this._endDate.getTime();
};

ZmFreeBusyAppointment.prototype.getDuration = function() {
	return this._endDate.getTime() - this._startDate.getTime();
};
