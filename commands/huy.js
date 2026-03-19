const { SlashCommandBuilder } = require('discord.js');
const sheets = require('../sheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('huy-xe')
    .setDescription('Hủy đăng ký xe của bạn')
    .addStringOption(opt =>
      opt.setName('ma_don').setDescription('Mã đơn đăng ký (VD: XE123456)').setRequired(true)),

  async execute(interaction) {
    const bookingId = interaction.options.getString('ma_don').toUpperCase();
    await interaction.deferReply({ ephemeral: true });

    try {
      const booking = await sheets.getBookingById(bookingId);

      if (!booking) {
        return await interaction.editReply({ content: `❌ Không tìm thấy đơn **${bookingId}**.` });
      }

      // Chỉ người tạo đơn hoặc admin mới được hủy
      const isAdmin = interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
      if (booking.userId !== interaction.user.id && !isAdmin) {
        return await interaction.editReply({ content: '❌ Bạn không có quyền hủy đơn này.' });
      }

      if (booking.status === 'Đã hủy') {
        return await interaction.editReply({ content: '⚠️ Đơn này đã được hủy trước đó.' });
      }

      await sheets.updateBookingStatus(bookingId, 'Đã hủy', `Hủy bởi ${interaction.user.username}`);

      // Thông báo vào channel hành chính
      const bookingChannel = interaction.guild.channels.cache.get(process.env.BOOKING_CHANNEL_ID);
      if (bookingChannel) {
        await bookingChannel.send(
          `🚫 Đơn **${bookingId}** đã bị hủy bởi <@${interaction.user.id}> (${booking.date} - ${booking.destination})`
        );
      }

      await interaction.editReply({ content: `✅ Đã hủy đơn **${bookingId}** thành công.` });

    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Có lỗi xảy ra, vui lòng thử lại.' });
    }
  },
};
