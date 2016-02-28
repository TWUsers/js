function theme_js(){
 
wp_enqueue_script('jquery');
 
 wp_enqueue_script( 'testK',
get_template_directory_uri() . 'docs/js/test.js',
array() );
 
wp_enqueue_script( 'jquery_ui_minCSS',
get_template_directory_uri() . 'docs/js/jquery-ui.min.css',
array() );
 
wp_enqueue_script( 'jquery_min',
get_template_directory_uri() . 'docs/js/jquery.min.js',
array() );

wp_enqueue_script( 'jquery_ui_minJS',
get_template_directory_uri() . 'docs/js/jquery-ui.min.js',
array() );


wp_enqueue_script( 'keyboard',
get_template_directory_uri() . 'css/keyboard.css',
array() );

wp_enqueue_script( 'keyboard_previewkeysetCSS',
get_template_directory_uri() . 'css/keyboard-previewkeyset.css',
array() );

wp_enqueue_script( 'jquery_keyboard',
get_template_directory_uri() . 'js/jquery.keyboard.js',
array() );


wp_enqueue_script( 'jquery_keyboard_extension_typing',
get_template_directory_uri() . 'js/jquery.keyboard.extension-typing.js',
array() );

wp_enqueue_script( 'keyboard_previewkeysetJS',
get_template_directory_uri() . 'js/jquery.keyboard.extension-previewkeyset.js',
array() );

wp_enqueue_script( 'keyboard_layouts_microsoft',
get_template_directory_uri() . 'layouts/keyboard-layouts-microsoft.js',
array() );


	
}
add_action( 'wp_head', 'theme_js' );

----------------------------------------------------------

function wptuts_scripts_with_the_lot()
{
   wp_deregister_script( 'jquery' );
	wp_register_script( 'jquery', 'http://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js', array(), null, false );
 
    // Register the script like this for a theme:
    wp_register_script( 'custom-script', get_stylesheet_directory_uri() . '/js/testJ.js', array( 'jquery', 'jquery-ui-core' ), '20120208', false );
	
wp_register_style( 'custom-style', get_stylesheet_directory_uri() . '/css/testJ.css', array(), '20120208', 'all' );
 
    // For either a plugin or a theme, you can then enqueue the script:
    wp_enqueue_script( 'custom-script' );
	
wp_enqueue_style( 'custom-style' );	
}
add_action( 'wp_enqueue_scripts', 'wptuts_scripts_with_the_lot' );
------------------------------------------------------------
wp_register_script( 'Kj', get_stylesheet_directory_uri() . '/Virtual_fichiers/jquery.js', array('jquery', 'jquery-ui-core'), null, false  );
wp_register_script( 'Kj1', get_stylesheet_directory_uri() . '/Virtual_fichiers/jquery_002.js', array('jquery', 'jquery-ui-core'), null, false  );
wp_register_script( 'Kj2', get_stylesheet_directory_uri() . '/Virtual_fichiers/jquery_003.js', array('jquery', 'jquery-ui-core'), null, false  );
wp_register_script( 'Kj3', get_stylesheet_directory_uri() . '/Virtual_fichiers/jquery_004.js', array('jquery', 'jquery-ui-core'), null, false  );
wp_register_script( 'Kj4', get_stylesheet_directory_uri() . '/Virtual_fichiers/jquery_005.js', array('jquery', 'jquery-ui-core'), null, false  );
wp_register_script( 'Kj5', get_stylesheet_directory_uri() . '/Virtual_fichiers/jquery-ui.js', array('jquery', 'jquery-ui-core'), null, false  );
wp_register_script( 'Kj6', get_stylesheet_directory_uri() . '/Virtual_fichiers/keyboard-layouts-microsoft.js', array('jquery', 'jquery-ui-core'), null, false  );


wp_enqueue_script( 'Kj' );	
wp_enqueue_script( 'Kj1' );
wp_enqueue_script( 'Kj2' );	
wp_enqueue_script( 'Kj3' );
wp_enqueue_script( 'Kj4' );	
wp_enqueue_script( 'Kj5' );
wp_enqueue_script( 'Kj6' );
--------------------------------------------------------------

<script src="http://127.0.0.1:4001/wordpress/wp-content/themes/virtue-child/js/jquery.min.js"></script>
<script src="http://127.0.0.1:4001/wordpress/wp-content/themes/virtue-child/js/jquery-ui.min.js"></script>
<script src="http://127.0.0.1:4001/wordpress/wp-content/themes/virtue-child/js/jquery.keyboard.js"></script>

----------------------

[raw]
<script>
	$(function(){

		var t,
			o = '',
			layouts = [];

		// Change display language, if the definitions are available
		showKb = function(layout){
			var kb = $('#multi').getkeyboard();
			kb.options.layout = layout;
			// true flag causes a keyboard refresh
			kb.reveal(true);
		};
		
			layouts.push(["ms-Wolof"]);
		
		$.each(layouts, function(){
			o += '<option value="ms-Wolof"> </option>';
		});

		$('#multi').keyboard({stayOpen: true})
		// activate the typing extension
		.addTyping({showTyping: true, delay: 0})
		.previewKeyset();

		$('#lang').html(o).change(function(){
				var kb = $('#multi'),
					$this = $(this),
					$opt = $this.find("ms-Wolof"),
					layout = $this.val();
				
				showKb( layout );
			}).trigger('change');

	});
	</script>

	[/raw]



<div id="page-wrap">
	
	<div class="block2" style="height:0;">
	<option value="ms-Wolof"></option>
		<select id="lang" style="display: none;"></select>
		<input id="multi" type="text"/>
	</div>
	
</div> 
<div style="height:35rem;display:block;"> </div>
