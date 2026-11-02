<div id="post-body"
     class="metabox-holder columns-2">
    <div id="post-body-content">
        <form class="columns-2" method="POST">
            <input type="hidden" name="field_add_nonce" value="<?php echo esc_attr( $nonce ) ?>">
            <table class="widefat striped"
                   style="max-width: 700px; margin-bottom: 25px;">
                <thead>
                    <tr>
                        <th><b><?php esc_html_e( 'General', 'disciple-tools-genmapper' ) ?></b></th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <label for="genmapper-chart-label">
                                <b><?php esc_html_e( 'Chart menu label', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="text" name="dt_genmapper_chart_label" id="genmapper-chart-label"
                                   value="<?php echo esc_attr( $chart_label ) ?>"
                                   maxlength="<?php echo esc_attr( DT_Genmapper_Tab_General::CHART_LABEL_MAX_LENGTH ) ?>"
                                   placeholder="<?php esc_attr_e( 'Gen Mapper', 'disciple-tools-genmapper' ) ?>">
                            <p>
                                <?php esc_html_e( 'The name shown for these charts in the Metrics menu, the admin menu and printed posters. Leave blank to use "Gen Mapper".', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
            <table class="widefat striped"
                   style="max-width: 700px; margin-bottom: 25px;">
                <thead>
                    <tr>
                        <th><b><?php esc_html_e( 'Church Circles', 'disciple-tools-genmapper' ) ?></b></th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <label for="genmapper-health-icons">
                                <b><?php esc_html_e( 'Show health icons in genmap?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_health_icons" <?php if ($show_health_icons): ?>checked<?php endif; ?> id="genmapper-health-icons">
                            <p>
                                <?php esc_html_e( 'Controls if the health metrics icon are shown in the group circles genmap.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-health-metrics">
                                <b><?php esc_html_e( 'Show health metrics in genmap?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_health_metrics" <?php if ($show_health_metrics): ?>checked<?php endif; ?> id="genmapper-health-metrics">
                            <p>
                                <?php esc_html_e( 'Controls if there fields are shown/enabled: Believer Count, Baptizer Count and Baptized in Group count. These fields are shown in the member list tile on a group record and over the circle on a group circles genmap.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-collapse-health-metrics">
                                <b><?php esc_html_e( 'Collapse group page health metric fields on groups page?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_collapse_metrics" <?php if ($collapse_health_metrics_fields): ?>checked<?php endif; ?> id="genmapper-collapse-health-metrics">
                            <p>
                                <?php esc_html_e( 'Controls the display style of the count fields in the member list tile on a group record.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-show-generation">
                                <b><?php esc_html_e( 'Show generation labels?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_generation" <?php if ($show_generation): ?>checked<?php endif; ?> id="genmapper-show-generation">
                            <p>
                                <?php esc_html_e( 'Shows the generation number (Gen 1, Gen 2, ...) beside each group circle.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-show-people-count">
                                <b><?php esc_html_e( 'Show number of people?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_people_count" <?php if ($show_people_count): ?>checked<?php endif; ?> id="genmapper-show-people-count">
                            <p>
                                <?php esc_html_e( 'Shows the group\'s Member Count beside each group circle.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-show-unmultiplied">
                                <b><?php esc_html_e( 'Show groups that haven\'t multiplied?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_unmultiplied" <?php if ($show_unmultiplied): ?>checked<?php endif; ?> id="genmapper-show-unmultiplied">
                            <p>
                                <?php esc_html_e( 'Also shows first-generation groups that have no child groups yet. When off, only first-generation groups that have multiplied are shown.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-show-coaching">
                                <b><?php esc_html_e( 'Highlight groups receiving coaching?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_coaching" <?php if ($show_coaching): ?>checked<?php endif; ?> id="genmapper-show-coaching">
                            <p>
                                <?php esc_html_e( 'Fills the circle of groups that have at least one coach, so you can see at a glance which groups are being coached.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-show-timeline-tile">
                                <b><?php esc_html_e( 'Show timeline on group records?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_timeline_tile" <?php if ($show_timeline_tile): ?>checked<?php endif; ?> id="genmapper-show-timeline-tile">
                            <p>
                                <?php esc_html_e( 'Adds a Timeline tile to each group record: when it started, became an ecclesia, and its baptisms, coaching, child groups and health practices along the way. The full timelines are under Metrics.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-coaching-group-type">
                                <b><?php esc_html_e( 'Coaching groups', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <select name="dt_genmapper_coaching_group_type" id="genmapper-coaching-group-type">
                                <option value="" <?php selected( $coaching_group_type, '' ); ?>><?php esc_html_e( 'None (off)', 'disciple-tools-genmapper' ) ?></option>
                                <?php foreach ( $group_type_options as $type_key => $type_label ) : ?>
                                    <option value="<?php echo esc_attr( $type_key ) ?>" <?php selected( $coaching_group_type, $type_key ); ?>><?php echo esc_html( $type_label ) ?></option>
                                <?php endforeach; ?>
                            </select>
                            <p>
                                <?php esc_html_e( 'Groups of this Group Type are drawn as triangles. Each is enclosed with the groups it coaches: a group is coached by a coaching group when one of the group\'s coaches is a member of that coaching group.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-connection-display">
                                <b><?php esc_html_e( 'Show on group circles', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <select name="dt_genmapper_connection_display" id="genmapper-connection-display">
                                <option value="coach" <?php selected( $connection_display, 'coach' ); ?>><?php esc_html_e( 'Coach', 'disciple-tools-genmapper' ) ?></option>
                                <option value="leaders" <?php selected( $connection_display, 'leaders' ); ?>><?php esc_html_e( 'Group Leaders', 'disciple-tools-genmapper' ) ?></option>
                            </select>
                            <p>
                                <?php esc_html_e( 'Controls whether the group circles display the connected coaches or the group leaders.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
            <table class="widefat striped"
                   style="max-width: 700px; margin-bottom: 25px;">
                <thead>
                    <tr>
                        <th><b><?php esc_html_e( 'Health watch', 'disciple-tools-genmapper' ) ?></b></th>
                        <th><?php esc_html_e( 'Flags groups that may need a check-in. Flags are only shown on the charts; nothing is changed on the records.', 'disciple-tools-genmapper' ) ?></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <label for="genmapper-show-health-flags">
                                <b><?php esc_html_e( 'Show health flags on the group chart?', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="checkbox" name="dt_genmapper_show_health_flags" <?php if ($show_health_flags): ?>checked<?php endif; ?> id="genmapper-show-health-flags">
                            <p>
                                <?php esc_html_e( 'Adds an amber "!" beside group circles that have flags, with the reasons on hover. The full list is on the Timelines page.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-watch-percentile">
                                <b><?php esc_html_e( 'Behind the usual pace', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="number" name="dt_genmapper_watch_percentile" id="genmapper-watch-percentile" value="<?php echo esc_attr( $watch_numbers['dt_genmapper_watch_percentile'] ) ?>"
                                   min="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_percentile'][1] ) ?>"
                                   max="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_percentile'][2] ) ?>" style="width: 5em"> %
                            <p>
                                <?php esc_html_e( 'A group is flagged when it has not reached a milestone (a coach, baptisms, becoming an ecclesia, multiplying) by the time this share of groups in your movement had reached it.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-watch-quiet">
                                <b><?php esc_html_e( 'Gone quiet after', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="number" name="dt_genmapper_watch_quiet_months" id="genmapper-watch-quiet" value="<?php echo esc_attr( $watch_numbers['dt_genmapper_watch_quiet_months'] ) ?>"
                                   min="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_quiet_months'][1] ) ?>"
                                   max="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_quiet_months'][2] ) ?>" style="width: 5em"> <?php esc_html_e( 'months', 'disciple-tools-genmapper' ) ?>
                            <p>
                                <?php esc_html_e( 'Flags active groups with no updates or comments for this long.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-watch-member-drop">
                                <b><?php esc_html_e( 'Member count drop', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="number" name="dt_genmapper_watch_member_drop" id="genmapper-watch-member-drop" value="<?php echo esc_attr( $watch_numbers['dt_genmapper_watch_member_drop'] ) ?>"
                                   min="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_member_drop'][1] ) ?>"
                                   max="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_member_drop'][2] ) ?>" style="width: 5em"> %
                            <p>
                                <?php esc_html_e( 'Flags groups whose Member Count fell this much below its highest in the last 12 months.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="genmapper-watch-coach-load">
                                <b><?php esc_html_e( 'Groups per coach', 'disciple-tools-genmapper' )?></b>
                            </label>
                        </td>
                        <td>
                            <input type="number" name="dt_genmapper_watch_coach_load" id="genmapper-watch-coach-load" value="<?php echo esc_attr( $watch_numbers['dt_genmapper_watch_coach_load'] ) ?>"
                                   min="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_coach_load'][1] ) ?>"
                                   max="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS['dt_genmapper_watch_coach_load'][2] ) ?>" style="width: 5em"> 
                            <p>
                                <?php esc_html_e( 'Lists coaches (and coaching groups, per member) with more active groups than this.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <b><?php esc_html_e( 'Guide: months to each milestone', 'disciple-tools-genmapper' )?></b>
                        </td>
                        <td>
                            <?php foreach ( DT_Genmapper_Health_Watch::milestone_labels() as $milestone_option => $milestone_label ) : ?>
                                <label style="display: inline-block; margin: 0 12px 6px 0">
                                    <?php echo esc_html( $milestone_label ) ?>
                                    <input type="number" name="<?php echo esc_attr( $milestone_option ) ?>" value="<?php echo esc_attr( $watch_numbers[ $milestone_option ] ) ?>"
                                           min="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS[ $milestone_option ][1] ) ?>"
                                           max="<?php echo esc_attr( DT_Genmapper_Health_Watch::NUMBER_OPTIONS[ $milestone_option ][2] ) ?>" style="width: 5em">
                                </label>
                            <?php endforeach; ?>
                            <p>
                                <?php esc_html_e( 'A group is never flagged as behind sooner than these months. They are also used until at least 10 groups have reached a milestone. Your own pace can only make a flag later: when your groups usually get there sooner (e.g. coaches added together with a new record), the guide is used.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <b><?php esc_html_e( 'Key practices', 'disciple-tools-genmapper' )?></b>
                        </td>
                        <td>
                            <?php foreach ( $practice_options as $practice_key => $practice_label ) : ?>
                                <label style="display: inline-block; margin-right: 12px">
                                    <input type="checkbox" name="dt_genmapper_watch_key_practices[]" value="<?php echo esc_attr( $practice_key ) ?>" <?php checked( in_array( $practice_key, $watch_practices, true ) ); ?>>
                                    <?php echo esc_html( $practice_label ) ?>
                                </label>
                            <?php endforeach; ?>
                            <p>
                                <?php esc_html_e( 'Flags an ecclesia that does not have all of these Church Health practices marked.', 'disciple-tools-genmapper' ) ?>
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
            <input class="button hollow" type="submit" value="Save" />
        </form>
    </div><!-- end post-body-content -->
</div><!-- post-body meta box container -->
