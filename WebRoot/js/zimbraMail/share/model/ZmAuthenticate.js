function ZmAuthenticate(appCtxt) {
	if (arguments.length == 0) return;
	this._appCtxt = appCtxt;
};

ZmAuthenticate._isAdmin = false;

ZmAuthenticate.setAdmin =
function(isAdmin) {
	ZmAuthenticate._isAdmin = isAdmin;
};

ZmAuthenticate.prototype.toString = 
function() {
	return "ZmAuthenticate";
};

ZmAuthenticate.prototype.execute =
function(uname, pword) {
	if (!ZmAuthenticate._isAdmin) {
		var soapDoc = AjxSoapDoc.create("AuthRequest", "urn:liquidAccount");
		var header = soapDoc.createHeaderElement();
		var context = soapDoc.set("context", null, header);
		context.setAttribute("xmlns", "urn:liquid");
		var js = soapDoc.set("format", null, context);
		js.setAttribute("type", "js");

		var el = soapDoc.set("account", uname);
		el.setAttribute("by", "name");
		soapDoc.set("password", pword);

		var resp = LsCsfeCommand.invoke(soapDoc, true).Body.AuthResponse;
		this._setAuthToken(resp);
	} else {
		var soapDoc = AjxSoapDoc.create("AuthRequest", "urn:liquidAdmin", null);
		soapDoc.set("name", uname);
		soapDoc.set("password", pword);
		var resp = LsCsfeCommand.invoke(soapDoc, true).Body.AuthResponse;
		this._setAuthToken(resp);	
	}
};

ZmAuthenticate.prototype._setAuthToken =
function(resp) {
	var lifetime = !this._appCtxt.isPublicComputer() ? resp.lifetime : null;
	// ignore sessionId so we get a <refresh> block
	LsCsfeCommand.setAuthToken(resp.authToken, lifetime);
};
