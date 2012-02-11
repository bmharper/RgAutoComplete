
/*

RgAutoComplete:	Attach to a text box to get an autocomplete dropdown
Dependencies:	jquery 1.7.1, RgAutoComplete.css

*/

/**
 * @constructor
 * @param {(string|number)}									textbox_id		ID of your text box
 * @param {function(string): Array.<RgAutoCompleteObj>}		compute_list	Function that returns an array of RgAutoCompleteObj objects
 * @param {?function()}										movenext		An optional function that will get executed if the user presses ENTER to complete the text box
 * 																			Note that this function will not get called if the user presses TAB, because I cannot figure out
 * 																			how to stop propagation of a TAB key but we don't want a double-move.
 */
function RgAutoComplete( textbox_id, compute_list, movenext )
{
	var textbox = $("#" + textbox_id);
	var hintid = textbox_id + "_ach";
	var baseid = textbox_id + "_ac";
	var tstr = "";
	tstr += "<div id='" + hintid + "' class='autocomplete-hint'></div>";
	tstr += "<table id='" + baseid + "-outer' class='autocomplete-outer' cellpadding='0' cellspacing='0'><tbody><tr><td>";
	tstr += "<table id='" + baseid + "' class='autocomplete' cellpadding='0' cellspacing='0'><tbody></tbody></table>";
	tstr += "</td></tr></tbody></table>";
	textbox.after( tstr );

	this.BaseID			= baseid;
	this.TextBox		= textbox;
	this.MoveNext		= movenext;
	this.Current		= -1;
	this.List			= [];				// list from compute_list. of type RgAutoCompleteObj
	this.ComputeList	= compute_list;
	this.NextChar		= "";
	this.EatNextKeyUp	= false;
	this.LastCursorX	= 0;
	this.LastCursorY	= 0;
	this.HaveFocus		= false;
	this.HideUntilEmpty	= false;
	this.AllowHint		= true;
	this.KeysTyped		= "";
	this.THint			= $("#" + hintid);
	this.TOuter			= $("#" + baseid + "-outer");
	this.TInner			= $("#" + baseid);
	this.TBody			= $("#" + baseid + " tbody");

	var self = this;

	var keydown = function(e) {
		//trace("keydown: " + e.which);
		switch( e.keyCode )
		{
		case 38:	if ( !self.IsVisible() ) { self.Show(); self.Move(0); }		else self.Move( -1 ); break;	// up
		case 40:	if ( !self.IsVisible() ) { self.Show(); self.Move(0); }		else self.Move(  1 ); break;	// down
		case 9:
		case 13:
			if ( self.IsVisibleOrHintShown() )			{ self.Pick( e.keyCode == 9 ); e.stopImmediatePropagation(); }
			break;
		case 27:
			if ( self.IsVisible() )
			{
				self.Hide();
				self.HideUntilEmpty = true;
				e.stopImmediatePropagation();
			}
			break;
		case 8:
		case 46:
			// backspace, delete
			self.EatNextKeyUp = true;
			break;
		}
	};
	var keypress = function(e) {
		//trace("keypress: " + e.which);
		// Firefox alone sends keypress for LEFT,RIGHT,etc (nonprintables), but which = 0 in this case.
		if ( e.which != 0 )
		{
			self.NextChar = String.fromCharCode( e.which );
			self.Refresh();
		}
	};
	var keyup = function(e) {
		//trace("keyup: " + e.which);
		self.NextChar = "";
		if ( self.EatNextKeyUp )
		{
			self.EatNextKeyUp = false;
			self.Refresh();
		}
	};

	this.TextBox.keydown( keydown );
	this.TextBox.keypress( keypress );
	this.TextBox.keyup( keyup );
	this.TextBox.focus( function() { self.HaveFocus = true; self.Refresh(); } );
	this.TextBox.blur( function() { self.HaveFocus = false; self.Hide(); } );

	this.Hide();
	this.Refresh();
}

RgAutoComplete.Clamp = function( x, min, max )
{
	x = Math.max(x, min);
	x = Math.min(x, max);
	return x;
};

RgAutoComplete.ArrayEqual = function( a, b, equals )
{
	if ( a == null && b == null ) return true;
	if ( a != null || b != null ) return false;
	if ( a.length != b.length ) return false;
	if ( !equals ) equals = function(a,b) { return a === b; };
	for ( var i = 0; i < a.length; i++ )
	{
		if ( !equals( a[i], b[i] ) ) return false;
	}
	return true;
};

RgAutoComplete.prototype.ItemId = function( i ) { return this.BaseID + "_item_" + i };

RgAutoComplete.prototype.Move = function( delta )
{
	this.Current = RgAutoComplete.Clamp( this.Current + delta, 0, this.List.length - 1 );
	for ( var i = 0; i < this.List.length; i++ )
	{
		$("#" + this.ItemId(i)).css("background", this.Current == i ? "#eee" : "#fff")
	}
};

RgAutoComplete.prototype.IsVisibleOrHintShown = function()
{
	return this.IsVisible() || this.IsHintShown();
};

RgAutoComplete.prototype.IsVisible = function()
{
	return this.TOuter.is(":visible")
};

RgAutoComplete.prototype.IsHintShown = function()
{
	return this.THint.length === 1 && this.THint[0].innerHTML != ""
};

RgAutoComplete.prototype.Hide = function()
{
	this.TOuter.hide();
};

RgAutoComplete.prototype.Show = function()
{
	this.TOuter.show();
};

RgAutoComplete.prototype.Pick = function( fromTabKey )
{
	if ( this.Current != -1 )
	{
		this.KeysTyped = $.trim( this.TextBox.val() + "" );
		this.TextBox.val( this.List[this.Current].Title );
	}
	this.Hide();
	this.THint.hide();
	if ( this.MoveNext && !fromTabKey )
		this.MoveNext();
};

RgAutoComplete.prototype.MouseMove = function( ev )
{
	// ignore the very first mouse move message. We're basically just storing the 'initial' cursor pos here.
	if ( this.PageX == 0 && this.PageY == 0 )
	{
		this.PageX = ev.pageX;
		this.PageY = ev.pageY;
	}
	// ignore subsequent move messages if the cursor hasn't actually moved.
	// As we rebuild the completion list, the cursor will move in and out of the new elements, and we want to ignore that.
	if ( ev.pageX != this.PageX || ev.pageY != this.PageY )
	{
		this.PageX = ev.pageX;
		this.PageY = ev.pageY;
		this.Current = $(ev.target).data("index");
		this.Move(0);
	}
};

RgAutoComplete.prototype.PositionControl = function()
{
	var txtpos = this.TextBox.position();
	var txtw = this.TextBox.width();
	var width = this.TextBox.outerWidth() + 'px';

	this.TOuter.css( 'left', txtpos.left + 'px' );
	this.TOuter.css( 'top', txtpos.top + this.TextBox.outerHeight() + 'px' );
	this.TOuter.css( 'width', width );
	return width;
};

RgAutoComplete.prototype.Refresh = function()
{
	if ( !this.HaveFocus ) return;
	var self = this;
	var txt = $.trim(this.TextBox.val() + this.NextChar);
	var list = this.ComputeList( txt );
	if ( txt == "" ) this.HideUntilEmpty = false;
	if ( this.HideUntilEmpty ) return;

	var width = this.PositionControl();

	if ( !RgAutoComplete.ArrayEqual(this.List, list, function(a,b) { return a.Obj == b.Obj } ) )
	{
		this.Current = -1;
		this.List = list;
		var tbody = this.TBody;
		var tdefault = "";
		tbody.empty();
		for ( var i = 0; i < list.length; i++ )
		{
			var t = list[i];
			var id = this.ItemId(i);
			tbody.append( "<tr><td id='" + id + "'" + "></td></tr>" );
			var li = $("#" + id);
			li.text( t.Title );
			li.data( "index", i );
			li.bind( 'mousedown',	function(e) { self.Current = $(e.target).data("index"); self.Pick(false); } );
			li.bind( 'mousemove',	function(e) { self.MouseMove(e); } );
			li.css( 'width', width );
			if ( t.IsDefault )
			{
				this.Current = i;
				tdefault = t.Title;
			}
		}
		var showdrop = list.length != 0;
		if ( !this.AllowHint || txt != "" )	{ this.THint.hide(); }
		else								{ this.THint.show(); this.THint.empty(); this.THint.append( tdefault ); showdrop = false; }
		
		if ( showdrop ) this.Show();
		else			this.Hide();

		if ( showdrop )
			this.Move( 0 );
	}
};

/** @constructor **/
function RgAutoCompleteObj( obj, title, isdefault )
{
	this.Obj = obj;
	this.Title = title;
	this.IsDefault = isdefault;
}

RgAutoCompleteObj.CompareByTitle = function( a, b )
{
	return a.Title.toUpperCase() > b.Title.toUpperCase()
};
