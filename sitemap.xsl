<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
    xmlns:html="http://www.w3.org/TR/REC-html40"
    xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
    <xsl:template match="/">
        <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
                <title>Sitemap</title>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                <style type="text/css">
					body {
						font-family: "Roboto", sans-serif;
                        font-weight: 400;
						font-size: 18px;
                        color: #000000;
                        background-color: #fbfaf6;
                        position: relative;
                        margin: 0;
                        padding: 30px;
                        height: 100%;
					}
					.sitemap-head {
                        font-size:36px;
                        text-decoration: underline;
                        padding: 0 0 10px 0;
                        margin:0 0 30px 0;
                        border-bottom: thin solid #c0c0c0;
                    }
                    th {
						text-align:left;
						padding-right:30px;
						font-size:15px;
					}
					td {
						font-size:13px;
					}
					tr.high {
						background-color:whitesmoke;
					}
					
					#footer {
						padding:2px;
						margin:10px;
						font-size:8pt;
						color:gray;
					}
					
					#footer a {
						color:gray;
					}
					
					a {
						color:black;
					}
                </style>
            </head>
            <body>
                <div class="sitemap-head">Sitemap</div>
                <div id="content">
                    <table cellpadding="5">
                        <tr>
                            <th>URL</th>
                            <th>Priority</th>
                            <th>Change Frequency</th>
                            <th>LastChange (GMT)</th>
                        </tr>
                        <xsl:variable name="lower" select="'abcdefghijklmnopqrstuvwxyz'"/>
                        <xsl:variable name="upper" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'"/>
                        <xsl:for-each select="sitemap:urlset/sitemap:url">
                            <tr>
                                <xsl:if test="position() mod 2 != 1">
                                    <xsl:attribute name="class">high</xsl:attribute>
                                </xsl:if>
                                <td>
                                    <xsl:variable name="itemURL">
                                        <xsl:value-of select="sitemap:loc"/>
                                    </xsl:variable>
                                    <a href="{$itemURL}">
                                        <xsl:value-of select="sitemap:loc"/>
                                    </a>
                                </td>
                                <td>
                                    <xsl:value-of select="concat(sitemap:priority*100,'%')"/>
                                </td>
                                <td>
                                    <xsl:value-of select="concat(translate(substring(sitemap:changefreq, 1, 1),concat($lower, $upper),concat($upper, $lower)),substring(sitemap:changefreq, 2))"/>
                                </td>
                                <td>
                                    <xsl:value-of select="concat(substring(sitemap:lastmod,0,11),concat(' ', substring(sitemap:lastmod,12,5)))"/>
                                </td>
                            </tr>
                        </xsl:for-each>
                    </table>
                </div>
            </body>
        </html>
    </xsl:template>
</xsl:stylesheet>